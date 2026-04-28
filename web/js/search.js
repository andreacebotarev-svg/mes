/**
 * CryptMessenger — Search Controller
 */
const Search = (() => {
  const $ = (s) => document.querySelector(s);
  let searchActive = false;

  function init() {
    // Global search in sidebar (handled by Chat module for filtering conversations)
    // This module handles in-chat message search

    $('#search-chat-btn').addEventListener('click', toggleChatSearch);
  }

  function toggleChatSearch() {
    // For MVP, we'll use the sidebar search to filter conversations
    // Full in-chat search can be added in Phase 2
    const searchInput = $('#search-input');
    searchInput.focus();
    searchInput.value = '';
  }

  return { init };
})();
