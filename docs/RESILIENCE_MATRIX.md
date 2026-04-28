# 🦾 Resilience Matrix: UX Integrity & Edge Cases

## 1. Goal
To ensure that "Security never compromises UX" and that the messenger remains functional under extreme conditions.

---

## 2. Distributed State Resilience

| Condition | System Behavior | Data Integrity |
| :--- | :--- | :--- |
| **Complete Offline** | Messages are queued in IndexedDB. UI shows "Pending" (Clock icon). | No loss. PWA Background Sync handles retry. |
| **Browser Crash (Mid-Send)** | Ratchet state is updated *before* the API call. On restart, outbox is re-processed. | State consistency maintained via Atomic IDB transactions. |
| **Device Sync (Split Ratchet)** | If two devices use the same account, they must maintain separate Ratchet Chains (Epochs). | Prevent "Nonce Reuse" and "Key Mismatch". |
| **Server Latency / Race** | Messages arriving out of order are buffered. Decryptor looks up key by `counter`. | Handled by "Future Keys" buffer in CryptoClient. |

---

## 3. PWA Offline First Architecture
- **Service Worker (sw.js)**: Caches static assets (HTML/JS/CSS). The app loads in <1s even on 2G.
- **IndexedDB Vault**: The source of truth for the session.
- **Message Outbox**: A specialized IndexedDB store for messages that failed to upload. They are retried with the *exact same* cryptographic parameters once online.

---

## 4. Key Rotation Resilience
What happens if User A rotates keys while User B is offline?
1. **User A**: Generates new seed, resets local session, sends "Rotation Signal" to PB.
2. **User B (Offline)**: Continues to send messages on old chain.
3. **User B (Online)**: Receives "Rotation Signal" first. Wipes local old chain. New messages from A are accepted.
4. **Collision**: Messages sent by B during the gap will fail to decrypt for A (Showing: "🔒 Session lost"). This is intentional to prevent leakage.
