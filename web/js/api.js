/**
 * CryptMessenger — API Module (PocketBase Edition)
 * Handles Auth, CRUD, and Realtime using PocketBase SDK.
 */
const API = (() => {
  const pb = new PocketBase('http://127.0.0.1:8090'); // Replace with your PB URL
  const listeners = {};

  // --- Auth ---
  async function register(handle, password, displayName, inviteCode) {
    // In a real scenario, you'd verify inviteCode via a PB hook or custom route
    const data = {
      username: handle,
      password: password,
      passwordConfirm: password,
      display_name: displayName,
      handle: handle
    };
    const user = await pb.collection('users').create(data);
    return login(handle, password);
  }

  async function login(handle, password) {
    const authData = await pb.collection('users').authWithPassword(handle, password);
    return { token: pb.authStore.token, user: authData.record };
  }

  function logout() {
    pb.authStore.clear();
    window.location.reload();
  }

  async function getMe() {
    return pb.authStore.model;
  }

  async function updateProfile(data) {
    return pb.collection('users').update(pb.authStore.model.id, data);
  }

  // --- Users ---
  async function searchUsers(q) {
    return pb.collection('users').getList(1, 20, {
      filter: `username ~ "${q}" || display_name ~ "${q}"`
    });
  }

  async function getAllUsers() {
    return pb.collection('users').getFullList();
  }

  // --- Conversations ---
  async function getConversations() {
    // Fetch conversations where user is a member
    // Assuming a relation or junction table 'members'
    return pb.collection('conversations').getFullList({
      expand: 'members'
    });
  }

  async function createConversation(type, memberIds) {
    return pb.collection('conversations').create({
      type,
      members: memberIds
    });
  }

  // --- Messages ---
  async function getMessages(convId, cursor = null) {
    return pb.collection('messages').getList(1, 50, {
      filter: `conversation = "${convId}"`,
      sort: '-created',
      expand: 'sender'
    });
  }

  async function sendMessage(conversationId, body, nonce = null, replyToId = null, type = 'text', file = null) {
    const formData = new FormData();
    formData.append('conversation', conversationId);
    formData.append('sender', pb.authStore.model.id);
    formData.append('type', type);

    if (file && type === 'image') {
      const { encryptedBlob, nonce: fileNonce, counter } = await CryptoClient.encryptFile(file, conversationId);
      formData.append('media', encryptedBlob, 'image.enc');
      formData.append('nonce', fileNonce);
      formData.append('counter', counter);
      formData.append('body', '[Encrypted Image]');
    } else {
      const { ciphertext, nonce: msgNonce, counter } = await CryptoClient.encrypt(body, conversationId);
      formData.append('body', ciphertext);
      formData.append('nonce', msgNonce);
      formData.append('counter', counter);
    }

    if (replyToId) formData.append('replyTo', replyToId);

    return pb.collection('messages').create(formData);
  }

  // --- Realtime ---
  function connectSocket() {
    // PocketBase uses SSE for realtime. We subscribe to collections.
    pb.collection('messages').subscribe('*', (e) => {
      if (e.action === 'create') {
        emit('message:new', e.record);
      }
    });

    pb.collection('users').subscribe('*', (e) => {
      emit('user:presence', { userId: e.record.id, online: e.record.online });
    });

    console.log('⚡ PocketBase Realtime Connected');
    return { emit: (ev, data) => console.log('Socket.emit fallback', ev, data) };
  }

  // --- Reactions ---
  async function addReaction(messageId, emoji) {
    return pb.collection('reactions').create({
      message: messageId,
      user: pb.authStore.model.id,
      emoji: emoji
    });
  }

  // --- Event Emitter ---
  function on(event, cb) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(cb);
  }

  function emit(event, data) {
    if (!listeners[event]) return;
    listeners[event].forEach(cb => cb(data));
  }

  return {
    pb, // Expose raw instance if needed
    register, login, logout, getMe, updateProfile, searchUsers, getAllUsers,
    getConversations, createConversation,
    getMessages, sendMessage, 
    addReaction,
    connectSocket, 
    on, emit
  };
})();
