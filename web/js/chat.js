/**
 * CryptMessenger — Chat List Controller
 */
const Chat = (() => {
  const $ = (s) => document.querySelector(s);
  let conversations = [];
  let allUsers = [];
  let activeConversationId = null;
  const onlineUsers = new Set();
  const unreadCounts = new Map(); // conversationId -> count

  // Avatar colors palette
  const AVATAR_COLORS = [
    '#e17076', '#7bc862', '#6ec9cb', '#65aadd',
    '#ee7aae', '#faa774', '#a695e7', '#6ec9cb'
  ];

  function getAvatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }

  function getInitials(name) {
    return (name || '?').charAt(0).toUpperCase();
  }

  function init() {
    // --- Drawer (Burger Menu) ---
    const drawer = $('#left-drawer');
    const menuBtn = $('#menu-btn');
    
    // Toggle Drawer
    menuBtn.addEventListener('click', () => {
      updateDrawerInfo();
      drawer.classList.remove('hidden');
    });

    // Close Drawer on overlay click
    drawer.addEventListener('click', (e) => {
      if (e.target === drawer) drawer.classList.add('hidden');
    });

    // Drawer Actions
    drawer.querySelectorAll('.drawer-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        // Ignore clicks on toggle switch itself (handled separately)
        if (e.target.closest('.toggle-switch')) return;

        const action = item.dataset.action;
        if (action !== 'night-mode') drawer.classList.add('hidden'); // Close drawer for most actions

        switch (action) {
          case 'new-group':
            // Reuse new chat modal for now or alert
            openNewChatModal(); 
            break;
          case 'contacts':
            // Switch to People tab
            document.querySelector('.sidebar-tab[data-panel="people"]').click();
            break;
          case 'settings':
            openSettingsModal();
            break;
          case 'saved':
            // Open chat with self
            await openSavedMessages();
            break;
          case 'night-mode':
            toggleTheme();
            break;
          case 'logout':
            if (confirm('Log out of CryptMessenger?')) {
              API.logout();
              window.location.reload();
            }
            break;
          case 'calls':
            Toast.info('Audio/Video calls coming soon!');
            break;
        }
      });
    });

    // Night Mode Toggle (inside drawer)
    const themeToggle = $('#theme-toggle');
    // Initialize state
    const currentTheme = localStorage.getItem('theme') || 'dark';
    if (currentTheme === 'light') {
      document.body.classList.add('light-mode');
      themeToggle.checked = false;
    } else {
      themeToggle.checked = true;
    }

    themeToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        document.body.classList.remove('light-mode');
        localStorage.setItem('theme', 'dark');
      } else {
        document.body.classList.add('light-mode');
        localStorage.setItem('theme', 'light');
      }
    });

    // --- Settings Modal ---
    $('#close-settings-btn').addEventListener('click', () => {
      $('#settings-modal').classList.add('hidden');
    });

    $('#save-settings-btn').addEventListener('click', async () => {
      const display = $('#settings-display-name').value.trim();
      const bio = $('#settings-bio').value.trim();
      const btn = $('#save-settings-btn');
      
      try {
        btn.disabled = true;
        btn.textContent = 'Saving...';
        await API.updateProfile({ displayName: display, bio });
        
        // Update local state
        if (App.currentUser) {
          App.currentUser.displayName = display;
          App.currentUser.bio = bio;
        }
        $('#settings-modal').classList.add('hidden');
        Toast.success('Profile updated!');
      } catch (err) {
        Toast.error('Failed to save: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Save Changes';
      }
    });

    // --- Existing Init Logic ---
    // New chat FAB
    $('#new-chat-btn').addEventListener('click', openNewChatModal);
    $('#close-modal-btn').addEventListener('click', closeNewChatModal);
    $('#new-chat-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeNewChatModal();
    });

    // User search in modal
    let searchTimeout;
    $('#user-search-input').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => searchUsers(e.target.value), 300);
    });

    // Sidebar tabs (Chats / People)
    document.querySelectorAll('.sidebar-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const panel = tab.dataset.panel;
        document.getElementById(`${panel}-panel`).classList.add('active');

        if (panel === 'people') loadAllUsers();
      });
    });

    // Listen for presence updates
    API.on('user:presence', (data) => {
      if (data.online) onlineUsers.add(data.userId);
      else onlineUsers.delete(data.userId);
      renderChatList();
      renderPeopleList();
      updateChatHeader();
    });

    // Listen for presence list (initial)
    API.on('user:presence_list', (list) => {
      list.forEach(id => onlineUsers.add(id));
      renderChatList();
      renderPeopleList();
    });

    // Listen for new messages to update chat list
    API.on('message:new', (msg) => {
      const conv = conversations.find(c => c.id === msg.conversationId);
      if (conv) {
        conv.lastMessage = msg;
        // Move to top
        conversations = [conv, ...conversations.filter(c => c.id !== conv.id)];
        renderChatList();
      } else {
        // New conversation — reload list
        loadConversations();
      }

      // Track unread if not in this conversation
      if (msg.conversationId !== activeConversationId) {
        const current = unreadCounts.get(msg.conversationId) || 0;
        unreadCounts.set(msg.conversationId, current + 1);
        renderChatList();
      }
    });

    API.on('chat:key_rotated', async (data) => {
      const conv = conversations.find(c => c.members.some(m => m.id === data.from));
      if (conv) {
        CryptoClient.applyRotation(conv.id, data.seed);
        Toast.warn('Эпоха шифрования изменена');
        if (activeConversationId === conv.id) {
          updateChatHeader(conv);
          Messages.renderMessages(); // Old messages will fail to decrypt now
        }
      }
    });

    // Sidebar search
    $('#search-input').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      renderChatList(q);
    });

    // Back button (mobile)
    $('#back-btn').addEventListener('click', () => {
      $('#chat-area').classList.remove('chat-open');
      activeConversationId = null;
    });

    // Chat Menu Dropdown
    $('#chat-menu-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      $('#chat-dropdown').classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      $('#chat-dropdown').classList.add('hidden');
    });

    $('#rotate-keys-btn').addEventListener('click', rotateConversationKeys);
    $('#clear-history-btn').addEventListener('click', clearHistory);

    // Mobile Navigation (Bottom Bar)

    // Mobile Navigation (Bottom Bar)
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        if (view === 'settings') {
           openSettingsModal();
           return;
        }
        
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        if (view === 'chats') {
           document.querySelector('.sidebar-tab[data-panel="chats"]').click();
        } else if (view === 'people') {
           document.querySelector('.sidebar-tab[data-panel="people"]').click();
        }
      });
    });
  }

  // --- Drawer Functions ---
  function updateDrawerInfo() {
    const user = App.currentUser;
    if (!user) return;
    
    $('#drawer-name').textContent = user.displayName || user.handle;
    $('#drawer-handle').textContent = '@' + user.handle;
    $('#drawer-avatar').textContent = getInitials(user.displayName || user.handle);
    $('#drawer-avatar').style.background = getAvatarColor(user.displayName || user.handle);
  }

  function toggleTheme() {
    const isDark = !document.body.classList.contains('light-mode');
    if (isDark) {
      document.body.classList.add('light-mode');
      localStorage.setItem('theme', 'light');
      $('#theme-toggle').checked = false;
    } else {
      document.body.classList.remove('light-mode');
      localStorage.setItem('theme', 'dark');
      $('#theme-toggle').checked = true;
    }
  }

  async function openSavedMessages() {
    // "Saved Messages" is just a chat with yourself
    const me = App.currentUser;
    if (!me) return;

    // Check if conversation with self exists
    // (In a real app, this might be a special type, but here we just look for a direct chat with only 1 member or logic specific to it)
    // For simplicity, we search for a conversation where members = [me]
    // But createsConversation api takes memberIds array. If I send [me.id], it creates a self-chat?
    
    try {
      // Create/Get chat with self
      const data = await API.createConversation('direct', [me.id]); 
      API.joinConversation(data.conversation.id);
      await loadConversations();
      openConversation(data.conversation.id);
      // Auto-title if needed in UI
    } catch (err) {
      console.error('Failed to open Saved Messages:', err);
    }
  }

  // --- Settings Functions ---
  function openSettingsModal() {
    const user = App.currentUser;
    if (!user) return;

    $('#settings-display-name').value = user.displayName || '';
    $('#settings-handle').value = '@' + user.handle;
    $('#settings-bio').value = user.bio || ''; // Assuming user object now has bio
    
    $('#settings-avatar').textContent = getInitials(user.displayName || user.handle);
    $('#settings-avatar').style.background = getAvatarColor(user.displayName || user.handle);

    $('#settings-modal').classList.remove('hidden');
  }

  async function loadConversations() {
    try {
      const data = await API.getConversations();
      conversations = data.conversations;

      // Populate unread counts
      unreadCounts.clear();
      conversations.forEach(c => {
        if (c.unreadCount > 0) unreadCounts.set(c.id, c.unreadCount);
      });

      renderChatList();
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }

  async function loadAllUsers() {
    try {
      const data = await API.getAllUsers();
      allUsers = data.users;
      renderPeopleList();
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }

  function renderChatList(filter = '') {
    const list = $('#chat-list');
    const filtered = filter
      ? conversations.filter(c => c.title.toLowerCase().includes(filter))
      : conversations;

    if (filtered.length === 0) {
      list.innerHTML = `
        <div style="text-align:center; padding:40px 20px; color:var(--text-tertiary);">
          <p style="font-size:var(--font-size-sm);">${filter ? 'No results' : 'No conversations yet'}</p>
          ${!filter ? '<p style="font-size:var(--font-size-xs); margin-top:8px;">Click + to start a chat</p>' : ''}
        </div>
      `;
      return;
    }

    list.innerHTML = filtered.map(conv => {
      const isActive = conv.id === activeConversationId;
      const lastMsg = conv.lastMessage;
      const time = lastMsg ? formatTime(lastMsg.createdAt) : '';
      let preview = 'No messages yet';
      if (lastMsg) {
        if (lastMsg.deletedAt) preview = '🗑️ Message deleted';
        else if (lastMsg.type === 'image') preview = '📷 Photo';
        else preview = truncate(lastMsg.body, 40);
      }
      const color = getAvatarColor(conv.title);
      const initial = getInitials(conv.title);

      // Check if the other user is online
      const otherMember = conv.members?.find(m => m.id !== App.currentUser?.id);
      const isOnline = otherMember && onlineUsers.has(otherMember.id);
      const unread = unreadCounts.get(conv.id) || 0;

      return `
        <div class="chat-item ${isActive ? 'active' : ''}" data-conv-id="${conv.id}">
          <div class="avatar ${isOnline ? 'avatar-online' : ''}" style="background:${color}">${initial}</div>
          <div class="chat-item-info">
            <div class="chat-item-top">
              <span class="chat-item-name">${escapeHtml(conv.title)}</span>
              <span class="chat-item-time">${time}</span>
            </div>
            <div class="chat-item-preview">${escapeHtml(preview)}</div>
          </div>
          ${unread > 0 ? `<span class="unread-badge">${unread > 99 ? '99+' : unread}</span>` : ''}
        </div>
      `;
    }).join('');

    // Click handlers
    list.querySelectorAll('.chat-item').forEach(item => {
      item.addEventListener('click', () => {
        const convId = item.dataset.convId;
        openConversation(convId);
      });
    });
  }

  function renderPeopleList() {
    const list = $('#people-list');
    if (!list) return;

    if (allUsers.length === 0) {
      list.innerHTML = `
        <div style="text-align:center; padding:40px 20px; color:var(--text-tertiary);">
          <p style="font-size:var(--font-size-sm);">No other users yet</p>
        </div>
      `;
      return;
    }

    list.innerHTML = allUsers.map(user => {
      const color = getAvatarColor(user.displayName || user.handle);
      const initial = getInitials(user.displayName || user.handle);
      const isOnline = onlineUsers.has(user.id);

      return `
        <div class="chat-item people-item" data-user-id="${user.id}">
          <div class="avatar ${isOnline ? 'avatar-online' : ''}" style="background:${color}">${initial}</div>
          <div class="chat-item-info">
            <div class="chat-item-top">
              <span class="chat-item-name">${escapeHtml(user.displayName || user.handle)}</span>
              <span class="online-badge ${isOnline ? 'online' : ''}">${isOnline ? 'online' : 'offline'}</span>
            </div>
            <div class="chat-item-preview">@${escapeHtml(user.handle)}</div>
          </div>
        </div>
      `;
    }).join('');

    // Click to open direct chat
    list.querySelectorAll('.people-item').forEach(item => {
      item.addEventListener('click', async () => {
        const userId = item.dataset.userId;
        try {
          const data = await API.createConversation('direct', [userId]);
          API.joinConversation(data.conversation.id);
          await loadConversations();
          openConversation(data.conversation.id);
          // Switch to chats tab
          document.querySelector('.sidebar-tab[data-panel="chats"]').click();
        } catch (err) {
          console.error('Failed to start chat:', err);
        }
      });
    });
  }

  async function openConversation(convId) {
    activeConversationId = convId;
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;

    // Clear unread for this conversation
    unreadCounts.delete(convId);
    renderChatList();

    // Update sidebar active state
    document.querySelectorAll('.chat-item').forEach(el => {
      el.classList.toggle('active', el.dataset.convId === convId);
    });

    // Show chat area
    $('#empty-state').classList.add('hidden');
    $('#chat-header').classList.remove('hidden');
    $('#messages-container').classList.remove('hidden');
    $('#message-input-area').classList.remove('hidden');

    // Mobile: slide open
    $('#chat-area').classList.add('chat-open');

    // Set header
    updateChatHeader(conv);

    // Load messages
    await Messages.loadMessages(convId);

    // Focus input
    $('#message-input').focus();
  }

  function updateChatHeader(conv) {
    if (!conv && activeConversationId) {
      conv = conversations.find(c => c.id === activeConversationId);
    }
    if (!conv) return;

    const color = getAvatarColor(conv.title);
    $('#chat-avatar').textContent = getInitials(conv.title);
    $('#chat-avatar').style.background = color;
    $('#chat-title').textContent = conv.title;

    const otherMember = conv.members?.find(m => m.id !== App.currentUser?.id);
    const isOnline = otherMember && onlineUsers.has(otherMember.id);
    const statusEl = $('#chat-status');
    statusEl.textContent = isOnline ? 'online' : 'offline';
    statusEl.className = `chat-status ${isOnline ? 'online' : ''}`;

    // Update fingerprint
    const fingerprint = CryptoClient.getFingerprint(conv.id);
    $('#chat-fingerprint').textContent = fingerprint || '🔐';
  }

  async function rotateConversationKeys() {
    if (!activeConversationId) return;
    const conv = conversations.find(c => c.id === activeConversationId);
    const otherMember = conv.members.find(m => m.id !== App.currentUser.id);
    if (!otherMember) return;

    try {
      const seed = await CryptoClient.rotateKeys(activeConversationId);
      CryptoClient.applyRotation(activeConversationId, seed);
      
      API.emit('key_rotation', { to: otherMember.id, seed });
      
      Toast.success('Ключи безопасности обновлены');
      updateChatHeader(conv);
      Messages.renderMessages(); // Re-render to show unreadable old messages
    } catch (err) {
      Toast.error('Ошибка ротации ключей');
    }
  }

  async function clearHistory() {
    if (!activeConversationId) return;
    if (confirm('Очистить историю сообщений в этом чате?')) {
       // Logic to clear history on server could be added here
       Toast.info('История очищена локально');
       Messages.clearLocal(activeConversationId);
    }
  }

  function getActiveConversationId() {
    return activeConversationId;
  }

  function getConversation(id) {
    return conversations.find(c => c.id === id);
  }

  // --- New Chat Modal ---
  function openNewChatModal() {
    $('#new-chat-modal').classList.remove('hidden');
    $('#user-search-input').value = '';
    $('#user-search-results').innerHTML = '';
    setTimeout(() => $('#user-search-input').focus(), 100);
  }

  function closeNewChatModal() {
    $('#new-chat-modal').classList.add('hidden');
  }

  async function searchUsers(query) {
    if (!query || query.length < 2) {
      $('#user-search-results').innerHTML = '';
      return;
    }

    try {
      const data = await API.searchUsers(query);
      const results = $('#user-search-results');

      if (data.users.length === 0) {
        results.innerHTML = '<p style="color:var(--text-tertiary); text-align:center; padding:20px;">No users found</p>';
        return;
      }

      results.innerHTML = data.users.map(user => {
        const color = getAvatarColor(user.displayName || user.handle);
        return `
          <div class="user-result" data-user-id="${user.id}">
            <div class="avatar" style="background:${color}">${getInitials(user.displayName || user.handle)}</div>
            <div class="user-result-info">
              <h4>${escapeHtml(user.displayName || user.handle)}</h4>
              <span>@${escapeHtml(user.handle)}</span>
            </div>
          </div>
        `;
      }).join('');

      results.querySelectorAll('.user-result').forEach(el => {
        el.addEventListener('click', async () => {
          const userId = el.dataset.userId;
          try {
            const data = await API.createConversation('direct', [userId]);
            closeNewChatModal();
            API.joinConversation(data.conversation.id);
            await loadConversations();
            openConversation(data.conversation.id);
          } catch (err) {
            console.error('Failed to create conversation:', err);
          }
        });
      });
    } catch (err) {
      console.error('User search failed:', err);
    }
  }

  // --- Helpers ---
  function formatTime(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;

    if (diff < 86400000 && d.getDate() === now.getDate()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diff < 604800000) {
      return d.toLocaleDateString([], { weekday: 'short' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '…' : str;
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    init, loadConversations, loadAllUsers, renderChatList, openConversation,
    getActiveConversationId, getConversation, updateChatHeader,
    getAvatarColor, getInitials, escapeHtml, formatTime
  };
})();
