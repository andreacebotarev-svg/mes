# 🕵️ The Adversary's Map: Security Threat Modeling

## 1. Tactical Overview
This document outlines the system's defenses from the perspective of an attacker. Our goal is to ensure that even a "God-Mode" attacker (with full server access) cannot compromise user privacy.

---

## 2. Attack Vectors & Defensive Countermeasures

| Vector | Attacker's Goal | Architectural Defense | Status |
| :--- | :--- | :--- | :--- |
| **Server Compromise** | Read message history. | **E2EE (XChaCha20-Poly1305)**: Server only sees encrypted blobs. No keys ever hit the wire. | **Hardened** |
| **MITM (Active)** | Inject malicious public keys. | **Signed Pre-keys**: Identity keys sign the ephemeral pre-keys. Manipulation is detected by the client. | **Resistant** |
| **Device Theft** | Recover keys from disk. | **IndexedDB Vault**: Keys are not in localStorage. Manual "Nuke" renders data "Digital Ash". | **Mitigated** |
| **Replay Attack** | Re-send old encrypted msgs. | **Monotonic Counters**: Every message has a unique sequence number. Out-of-order or duplicate msgs are rejected. | **Hardened** |
| **Traffic Analysis** | Identify who is talking. | **Metadata Minimization**: PocketBase API Rules restrict access. (Future: Padding/Dummy traffic). | **Partial** |

---

## 3. "Digital Ash" Philosophy
The ultimate defense is the destruction of secrets. 
- **Manual Epoch Reset**: When a user rotates keys, the entire chain is destroyed on both ends. 
- **Result**: Even if a sovereign state seizes the servers *after* a reset, the history is mathematically impossible to recover.

---

## 4. Known "Dead Ends" for Attackers
1. **The TLS Trap**: An attacker stripping TLS still faces XChaCha20 application-level encryption.
2. **The Database Dump**: A full `data.db` dump contains zero usable plaintext or private keys.
3. **The Socket Sniffer**: Real-time events only signal *that* something happened, not *what* happened.
