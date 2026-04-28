# API & Backend: PocketBase Integration

## 1. PocketBase Collections

### 1.1. `users` (System)
Extended with custom fields for E2EE:
- `handle`: Unique username string.
- `display_name`: Optional public name.
- `bio`: Short user description.
- `public_key`: Base64 Identity Key (DH).
- `signed_pre_key`: Base64 Signed Pre-key.
- `pre_key_signature`: Signature of the pre-key.

### 1.2. `conversations`
- `type`: `direct` or `group`.
- `members`: Relation (M:M) to `users`.
- **API Rules**: 
  - List/View: `members.id ?= @request.auth.id`
  - Create: `@request.auth.id != ""`

### 1.3. `messages`
- `conversation`: Relation to `conversations`.
- `sender`: Relation to `users`.
- `body`: Encrypted text blob (Base64).
- `nonce`: Encryption nonce (Base64).
- `counter`: Ratchet index.
- `file`: (Optional) Encrypted file attachment.
- **API Rules**:
  - List/View: `conversation.members.id ?= @request.auth.id`
  - Create: `conversation.members.id ?= @request.auth.id && sender = @request.auth.id`

---

## 2. Automated Tasks (Cron)

### 2.1. Auto-Purge Hook (`pb_hooks/cleanup.pb.js`)
- **Schedule**: `0 0 * * *` (Daily at midnight).
- **Retention Policy**: 90 Days.
- **Logic**: 
  1. Finds all records in `messages` where `created < now - 90 days`.
  2. Deletes records in batches.
  3. PocketBase automatically removes associated physical files from the storage.

---

## 3. Real-time Events (Socket.io)
While PocketBase provides SSE, a hybrid Socket.io layer is used for transient events:
- `user:presence`: Notifies when a user goes online/offline.
- `chat:typing`: Real-time typing indicators.
- `chat:key_rotated`: Signals the start of a new security epoch.

---

## 4. Authentication Flow
1. **Client**: `POST /api/collections/users/auth-with-password`
2. **Server**: Returns JWT and user record.
3. **Client**: Stores JWT and initializes the `CryptoClient` with the local identity keys stored in IndexedDB.
4. **Validation**: All subsequent requests include the `Authorization: Bearer <JWT>` header.
