# 🧠 Project Deep Insights (Automated)
Generated: 2026-04-28T10:55:47.311Z

## 🛡️ Security Perimeter

### scripts\deep-insight.js
- **Crypto primitives**: None
- **Vault Secure Storage**: ✅ Yes (IndexedDB)

### scripts\system-audit.js
- **Crypto primitives**: None
- **Vault Secure Storage**: ❌ No

### web\index.html
- **Crypto primitives**: None
- **Vault Secure Storage**: ❌ No

### web\js\app.js
- **Crypto primitives**: None
- **Vault Secure Storage**: ❌ No

### web\js\auth.js
- **Crypto primitives**: None
- **Vault Secure Storage**: ❌ No

### web\js\crypto-client.js
- **Crypto primitives**: sodium.ready, sodium.crypto_sign_keypair, sodium.crypto_box_keypair, sodium.crypto_sign_detached, sodium.to_base64, sodium.from_base64, sodium.crypto_sign_verify_detached, sodium.crypto_box_beforenm, sodium.crypto_generichash, sodium.crypto_secretbox_KEYBYTES, sodium.from_string, sodium.randombytes_buf, sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES, sodium.crypto_aead_xchacha20poly1305_ietf_encrypt, sodium.crypto_aead_xchacha20poly1305_ietf_decrypt, sodium.to_string
- **Vault Secure Storage**: ✅ Yes (IndexedDB)

### web\sw.js
- **Crypto primitives**: None
- **Vault Secure Storage**: ❌ No


## 📡 API Interaction Map

- **web\js\app.js**: getToken, getMe, clearToken, connectSocket, logout

- **web\js\auth.js**: login, register, uploadKeys

- **web\js\calls.js**: on, emit, sendMessage

- **web\js\chat.js**: logout, updateProfile, on, createConversation, joinConversation, getConversations, getAllUsers, emit, searchUsers

- **web\js\messages.js**: on, markRead, sendTyping, uploadImage, sendMessage, getMessages, editMessage, deleteMessage, removeReaction, addReaction


## ⚠️ Architectural Risks (Senior Review Required)
- [ ] **server\src\routes\conversations.js**: Large file (Potential monolith)
- [ ] **server\src\sockets\handler.js**: Large file (Potential monolith)
- [ ] **web\css\app.css**: Large file (Potential monolith)
- [ ] **web\index.html**: Large file (Potential monolith)
- [ ] **web\js\auth.js**: Insecure storage (localStorage used for non-theme data)
- [ ] **web\js\calls.js**: Large file (Potential monolith)
- [ ] **web\js\chat.js**: Large file (Potential monolith)
- [ ] **web\js\crypto-client.js**: Large file (Potential monolith)
- [ ] **web\js\messages.js**: Large file (Potential monolith)

## 🧬 Core Logic Density
- **Total analyzed components**: 12
- **Security-to-Logic Ratio**: 140.00%
