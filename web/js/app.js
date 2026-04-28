/**
 * CryptMessenger — Main App Controller
 * Orchestrates initialization, auth state, and screen transitions.
 */
const App = (() => {
  const $ = (s) => document.querySelector(s);
  let currentUser = null;

  async function init() {
    // Initialize crypto
    try {
      await CryptoClient.init();
    } catch (e) {
      console.warn('Crypto init failed (libsodium may not be loaded):', e);
    }

    // Initialize modules
    Auth.init();
    Chat.init();
    Messages.init();
    Search.init();
    Calls.init();

    // Check for saved session
    const token = API.getToken();
    const savedUser = Auth.getSavedUser();

    if (token && savedUser) {
      // Verify token is still valid
      try {
        const data = await API.getMe();
        currentUser = data.user;
        Auth.saveUser(currentUser);
        showApp();
      } catch (err) {
        // Token expired
        API.clearToken();
        showAuth();
      }
    } else {
      showAuth();
    }
  }

  function onAuthSuccess(user) {
    currentUser = user;
    showApp();
  }

  async function showApp() {
    $('#auth-screen').classList.remove('active');
    $('#app-screen').classList.add('active');

    // Connect socket
    API.connectSocket();

    // Load conversations
    await Chat.loadConversations();
  }

  function showAuth() {
    $('#app-screen').classList.remove('active');
    $('#auth-screen').classList.add('active');
  }

  function logout() {
    currentUser = null;
    API.logout();
    CryptoClient.clear();
    showAuth();
  }

  function getCurrentUser() { return currentUser; }

  return { init, onAuthSuccess, showApp, showAuth, logout, get currentUser() { return currentUser; } };
})();

// --- Boot ---
document.addEventListener('DOMContentLoaded', () => App.init());
