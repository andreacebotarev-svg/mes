/**
 * CryptMessenger — Toast Notification System
 * Replaces all alert() calls with beautiful animated toasts.
 */
const Toast = (() => {
  let container = null;

  function init() {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  /**
   * Show a toast notification.
   * @param {string} message - Text to display
   * @param {'success'|'error'|'info'|'warning'} type - Toast type
   * @param {number} duration - Auto-dismiss time in ms (0 = manual)
   */
  function show(message, type = 'info', duration = 3500) {
    if (!container) init();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${escapeHtml(message)}</span>
      <button class="toast-close">✕</button>
    `;

    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => dismiss(toast));

    container.appendChild(toast);

    // Trigger enter animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.classList.add('toast-visible');
      });
    });

    // Auto-dismiss
    if (duration > 0) {
      toast._timeout = setTimeout(() => dismiss(toast), duration);
    }

    // Max 5 toasts
    while (container.children.length > 5) {
      dismiss(container.children[0]);
    }

    return toast;
  }

  function dismiss(toast) {
    if (!toast || !toast.parentNode) return;
    clearTimeout(toast._timeout);
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-exit');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    // Fallback removal
    setTimeout(() => toast.remove(), 400);
  }

  function success(msg, dur) { return show(msg, 'success', dur); }
  function error(msg, dur)   { return show(msg, 'error', dur || 5000); }
  function warning(msg, dur) { return show(msg, 'warning', dur); }
  function info(msg, dur)    { return show(msg, 'info', dur); }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { init, show, dismiss, success, error, warning, info };
})();
