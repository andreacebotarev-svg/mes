/**
 * CryptMessenger — Auth UI Controller
 */
const Auth = (() => {
  const $ = (s) => document.querySelector(s);

  function init() {
    // Tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        tab.classList.add('active');
        const form = tab.dataset.tab === 'login' ? '#login-form' : '#register-form';
        $(form).classList.add('active');
        clearError();
      });
    });

    // Login form
    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const handle = $('#login-handle').value.trim();
      const password = $('#login-password').value;

      if (!handle || !password) return showError('Fill in all fields');

      const btn = e.target.querySelector('button');
      btn.disabled = true;
      btn.textContent = 'Signing in...';

      try {
        const data = await API.login(handle, password);
        saveUser(data.user);
        App.onAuthSuccess(data.user);
      } catch (err) {
        showError(err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    });

    // Register form
    $('#register-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const handle = $('#reg-handle').value.trim();
      const displayName = $('#reg-display').value.trim();
      const password = $('#reg-password').value;
      const inviteCode = $('#reg-invite').value.trim();

      if (!handle || !password || !inviteCode) return showError('Fill in all fields');

      const btn = e.target.querySelector('button');
      btn.disabled = true;
      btn.textContent = 'Creating account...';

      try {
        const data = await API.register(handle, password, displayName || undefined, inviteCode);
        saveUser(data.user);

        // Generate and upload crypto keys
        try {
          const bundle = CryptoClient.generateKeyBundle();
          await API.uploadKeys(bundle);
        } catch (cryptoErr) {
          console.warn('Failed to upload key bundle:', cryptoErr);
        }

        App.onAuthSuccess(data.user);
      } catch (err) {
        showError(err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Create Account';
      }
    });
  }

  function saveUser(user) {
    localStorage.setItem('crypt_user', JSON.stringify(user));
  }

  function getSavedUser() {
    try { return JSON.parse(localStorage.getItem('crypt_user')); } catch { return null; }
  }

  function showError(msg) {
    $('#auth-error').textContent = msg;
    setTimeout(clearError, 5000);
  }

  function clearError() {
    $('#auth-error').textContent = '';
  }

  return { init, getSavedUser, saveUser };
})();
