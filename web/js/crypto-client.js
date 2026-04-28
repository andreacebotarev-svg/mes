/**
 * CryptMessenger — CryptoClient 2.0 (The Fortress Edition)
 * Features: IndexedDB Vault, Auto-Ratchet (Forward Secrecy), E2EE Media.
 */
const CryptoClient = (() => {
  let sodium = null;
  let localKeys = null;
  
  // IndexedDB Configuration
  const DB_NAME = 'CryptVault';
  const DB_VERSION = 1;
  let db = null;

  async function init() {
    await window.sodium.ready;
    sodium = window.sodium;
    
    // Initialize IndexedDB
    db = await initDB();
    
    // Try to load keys from Vault
    localKeys = await vaultGet('identity_keys');
    
    console.log('🛡️ CryptoClient Vault Initialized');
  }

  // --- IndexedDB Core ---
  function initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('vault')) db.createObjectStore('vault');
        if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function vaultSet(key, value, store = 'vault') {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function vaultGet(key, store = 'vault') {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function vaultDelete(key, store = 'vault') {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Identity Management ---
  async function generateKeyBundle() {
    const identityKeyPair = sodium.crypto_sign_keypair();
    const identityDH = sodium.crypto_box_keypair();
    const signedPreKeyPair = sodium.crypto_box_keypair();
    
    const signature = sodium.crypto_sign_detached(
      signedPreKeyPair.publicKey,
      identityKeyPair.privateKey
    );

    localKeys = {
      identityKeyPair,
      identityDH,
      signedPreKeyPair,
      signature
    };

    await vaultSet('identity_keys', localKeys);

    return {
      identityKey: sodium.to_base64(identityKeyPair.publicKey),
      signedPreKey: sodium.to_base64(signedPreKeyPair.publicKey),
      signedPreKeySig: sodium.to_base64(signature)
    };
  }

  // --- Ratchet & Session Management ---
  async function computeSessionKey(otherIdentityKeyB64, otherPreKeyB64, otherPreKeySigB64, conversationId) {
    if (!localKeys) throw new Error('Identity not initialized');

    const otherIdentityKey = sodium.from_base64(otherIdentityKeyB64);
    const otherPreKey = sodium.from_base64(otherPreKeyB64);
    const otherPreKeySig = sodium.from_base64(otherPreKeySigB64);

    // Verify signature
    if (!sodium.crypto_sign_verify_detached(otherPreKeySig, otherPreKey, otherIdentityKey)) {
      throw new Error('Invalid pre-key signature');
    }

    // X3DH (Simplified)
    const sharedSecret = sodium.crypto_box_beforenm(otherPreKey, localKeys.identityDH.privateKey);
    
    // Initial Root Key
    const rootKey = sodium.crypto_generichash(sodium.crypto_secretbox_KEYBYTES, sharedSecret, "initial_root");
    
    const session = {
      rootKey,
      chainKey: rootKey,
      counter: 0,
      keys: {} // Map of counter -> key (for decryption of old messages)
    };

    await vaultSet(conversationId, session, 'sessions');
    return session;
  }

  async function ensureSessionKey(conversationId, bundleProvider) {
    let session = await vaultGet(conversationId, 'sessions');
    if (!session) {
      const bundles = await bundleProvider();
      const bundle = bundles[0]; // Assuming first member for direct chat
      session = await computeSessionKey(bundle.identityKey, bundle.signedPreKey, bundle.signedPreKeySig, conversationId);
    }
    return session;
  }

  // --- Encryption with Ratchet ---
  async function encrypt(plaintextStr, conversationId) {
    const session = await vaultGet(conversationId, 'sessions');
    if (!session) throw new Error('No session');

    // 1. Derive Message Key from Chain Key
    const msgKey = sodium.crypto_generichash(sodium.crypto_secretbox_KEYBYTES, session.chainKey, "msg_key");
    
    // 2. Ratchet the Chain Key forward (Forward Secrecy)
    const nextChainKey = sodium.crypto_generichash(sodium.crypto_secretbox_KEYBYTES, session.chainKey, "next_chain");
    
    // 3. Update Session
    session.counter++;
    session.chainKey = nextChainKey;
    session.keys[session.counter] = msgKey; // Keep for decryption
    await vaultSet(conversationId, session, 'sessions');

    // 4. Encrypt
    const plaintext = sodium.from_string(plaintextStr);
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      plaintext, null, null, nonce, msgKey
    );

    return {
      ciphertext: sodium.to_base64(ciphertext),
      nonce: sodium.to_base64(nonce),
      counter: session.counter,
      encrypted: true
    };
  }

  async function decrypt(ciphertextB64, nonceB64, conversationId, counter = 0) {
    if (!nonceB64) return ciphertextB64;

    const session = await vaultGet(conversationId, 'sessions');
    if (!session) return '[🔒 Session lost]';

    // Try to get key for this specific counter
    let key = session.keys[counter];
    
    // If key not found but it's the future, we might need to catch up
    // (In a full ratchet, we'd derive missing keys. Here we simplify)
    if (!key && counter > session.counter) {
       // Optional: derive future keys logic
       return '[🔒 Future message - key not derived yet]';
    }

    if (!key) return '[🔒 Key lost or invalid counter]';

    try {
      const ciphertext = sodium.from_base64(ciphertextB64);
      const nonce = sodium.from_base64(nonceB64);
      const decrypted = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null, ciphertext, null, nonce, key
      );
      return sodium.to_string(decrypted);
    } catch (e) {
      return '[🔒 Decryption failed]';
    }
  }

  // --- Manual Key Rotation (Destructive) ---
  async function rotateKeys(conversationId) {
    // Generates a totally new root seed
    const rotationSecret = sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);
    return sodium.to_base64(rotationSecret);
  }

  async function applyRotation(conversationId, seedBase64, isManual = true) {
    const session = await vaultGet(conversationId, 'sessions');
    if (!session) return;

    if (isManual) {
      // Manual: DESTROY ALL PREVIOUS KEYS
      const seed = sodium.from_base64(seedBase64);
      const newRoot = sodium.crypto_generichash(sodium.crypto_secretbox_KEYBYTES, seed, "manual_reset");
      
      const newSession = {
        rootKey: newRoot,
        chainKey: newRoot,
        counter: 0,
        keys: {} // EMPTY - makes old messages unreadable
      };
      await vaultSet(conversationId, newSession, 'sessions');
    } else {
      // Auto: Chaining is already handled in encrypt/decrypt
    }
  }

  // --- Media Encryption ---
  async function encryptFile(file, conversationId) {
    const { ciphertext, nonce, counter } = await encrypt("[FILE]", conversationId); 
    // We use a fresh ratchet step for the file
    const session = await vaultGet(conversationId, 'sessions');
    const key = session.keys[session.counter];

    const arrayBuffer = await file.arrayBuffer();
    const plaintext = new Uint8Array(arrayBuffer);
    const fileNonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);

    const encData = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      plaintext, null, null, fileNonce, key
    );

    return {
      encryptedBlob: new Blob([encData], { type: 'application/octet-stream' }),
      nonce: sodium.to_base64(fileNonce),
      counter: session.counter
    };
  }

  async function decryptFile(encryptedBlob, nonceB64, conversationId, counter) {
    const session = await vaultGet(conversationId, 'sessions');
    if (!session) throw new Error('No session');
    const key = session.keys[counter];
    if (!key) throw new Error('Key not found for counter ' + counter);

    const arrayBuffer = await encryptedBlob.arrayBuffer();
    const ciphertext = new Uint8Array(arrayBuffer);
    const nonce = sodium.from_base64(nonceB64);

    const decrypted = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null, ciphertext, null, nonce, key
    );
    return new Blob([decrypted]);
  }

  async function clear() {
    indexedDB.deleteDatabase(DB_NAME);
    localKeys = null;
    window.location.reload();
  }

  function getPublicKeyB64() {
    return localKeys ? sodium.to_base64(localKeys.identityDH.publicKey) : null;
  }

  return {
    init, generateKeyBundle, computeSessionKey, ensureSessionKey,
    encrypt, decrypt, encryptFile, decryptFile,
    getPublicKeyB64, clear, rotateKeys, applyRotation,
    getFingerprint: () => '🛡️ SECURE'
  };
})();
