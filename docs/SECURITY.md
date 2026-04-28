# Security: Deep Dive into E2EE & Fortress Mechanisms

## 1. Zero-Knowledge Encryption
CryptMessenger implements a strict Zero-Knowledge architecture.
- **Client-Side Generation**: All private keys are generated in the browser using `sodium.crypto_box_keypair()`.
- **No Private Keys on Server**: The server only stores **Public Identity Keys** and **Signed Pre-keys**.
- **XChaCha20-Poly1305**: All data (text and media) is encrypted using this AEAD (Authenticated Encryption with Associated Data) algorithm, providing both confidentiality and integrity.

---

## 2. Key Exchange (Simplified X3DH)
To establish a secure session without both parties being online, we use a simplified Extended Triple Diffie-Hellman (X3DH) flow:
1. **Alice** fetches **Bob's** "Bundle" (Identity Key + Signed Pre-key).
2. **Alice** verifies Bob's signature on his Pre-key using his Identity Key.
3. **Alice** performs a DH exchange to create a `Shared Secret`.
4. **Alice** derives the `Root Key` and starts the first `Chain Key`.

---

## 3. Ratchet Mechanism (Forward Secrecy)
We implement a **KDF Chain Ratchet** for every message:
- **Chain Key (CK)**: Derived from the Root Key.
- **Message Key (MK)**: `HMAC-SHA256(CK, "msg_key")`.
- **Next Chain Key**: `HMAC-SHA256(CK, "next_chain")`.

**Forward Secrecy**: Once a message is sent/received, the `MK` is deleted after use, and the `CK` moves forward. Even if the current `CK` is stolen, previously used `MK`s cannot be recovered.

---

## 4. IndexedDB Vault
Storing keys in `localStorage` is insecure as it's vulnerable to XSS. CryptMessenger uses **IndexedDB**:
- **Isolated Storage**: Keys are stored in a dedicated `CryptVault` database.
- **Structured Data**: Sessions, root keys, and derived message keys are kept in a structured binary format.
- **Cleanup**: Users can "Nuke" the Vault, which calls `indexedDB.deleteDatabase()`, instantly rendering all past messages unreadable on the device.

---

## 5. Security Epochs & Key Rotation
Users can manually trigger a **"New Security Epoch"**:
- **Mechanism**: Generates a completely new `Root Seed` and notifies the peer.
- **Destructive Action**: Both parties wipe their existing `Chain Keys` and `Message Keys` for that conversation.
- **Result**: "Digital Ash". Old encrypted messages in the database remain, but the keys to decrypt them are gone forever.

---

## 6. Protection against MITM
- **Public Key Fingerprints**: Each conversation displays a unique "Shield Fingerprint" (derived from the shared secret). Users can verify this out-of-band to ensure no Man-in-the-Middle.
- **Signed Pre-keys**: Prevents a compromised server from injecting malicious keys during session establishment.

---

## 7. Media Protection
- **Binary Encryption**: Files are encrypted as `Uint8Array` blobs.
- **Encrypted Nonces**: Each file has its own nonce, stored alongside the encrypted blob.
- **Decryption on the fly**: Media is decrypted into a `Blob URL` in memory and never written to the disk in plaintext.
