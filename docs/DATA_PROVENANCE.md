# 🧬 Cryptographic Provenance: Lifecycle of a Bit

## 1. Genesis: Plaintext Input
- **State**: Cleartext (Binary/UTF-8).
- **Location**: Browser Memory (RAM).
- **Protection**: Closure scope in `Messages.js`. No global variables.

## 2. Transformation: The Fortress Step
- **Action**: `CryptoClient.encrypt()`.
- **Logic**: 
    1. Derive Message Key (MK) via KDF from Chain Key (CK).
    2. CK = `sodium.crypto_generichash(CK, "next_chain")`.
    3. Ciphertext = `sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, MK, nonce)`.
- **Result**: Indistinguishable from noise.

## 3. Storage: The Local Vault
- **Action**: State persistence.
- **Location**: IndexedDB (`CryptVault` -> `sessions`).
- **Data**: New Chain Key + Message Index.
- **Security**: Isolated from `localStorage` and `sessionStorage`.

## 4. Transit: The Blind Relay
- **Action**: Upload to PocketBase.
- **Payload**: `{ body: base64_cipher, nonce: b64, counter: int }`.
- **Server Role**: Passive storage. No knowledge of MK or CK.

## 5. Arrival: Rehydration
- **Action**: `CryptoClient.decrypt()`.
- **Logic**:
    1. Fetch session from IndexedDB.
    2. Lookup/Derive MK for the specific `counter`.
    3. Decrypt using XChaCha20-Poly1305.
- **Cleanup**: Ephemeral keys are wiped from RAM after use.

## 6. Decay: Digital Ash
- **Trigger**: Cron Hook (90 Days).
- **Action**: Hard deletion from SQLite and File System.
- **Outcome**: The data ceases to exist in all physical and logical formats.
