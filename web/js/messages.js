/**
 * CryptMessenger — Messages Controller
 * Handles message rendering, sending, editing, deleting, images, context menu, and typing.
 */
const Messages = (() => {
  const $ = (s) => document.querySelector(s);
  const MAX_MESSAGES_IN_MEMORY = 200;
  let currentMessages = [];
  let hasMore = false;
  let nextCursor = null;
  let editingMessageId = null;
  let replyToMessage = null;
  let typingTimeout = null;
  let contextTarget = null;

  function init() {
    setupInputHandlers();
    setupEmojiPicker();
    
    // Global click to close emoji picker
    document.addEventListener('click', (e) => {
      const picker = $('#emoji-picker');
      const btn = $('#emoji-toggle-btn');
      if (!picker.classList.contains('hidden') && 
          !picker.contains(e.target) && 
          !btn.contains(e.target)) {
        picker.classList.add('hidden');
        btn.classList.remove('active');
      }
    });

    // Listen for incoming messages
    API.on('message:new', (msg) => {
      const convId = Chat.getActiveConversationId();
      if (msg.conversationId === convId) {
        // Avoid duplicates
        if (!currentMessages.find(m => m.id === msg.id)) {
          addMessage(msg);
          scrollToBottom();
        }
        // Auto mark as read
        API.markRead(convId, msg.id);
      }
    });

    API.on('message:edited', (msg) => {
      const convId = Chat.getActiveConversationId();
      if (msg.conversationId === convId) {
        updateMessage(msg);
      }
    });

    API.on('message:deleted', (data) => {
      if (data.conversationId === Chat.getActiveConversationId()) {
        removeMessage(data.messageId);
      }
    });

    // Typing indicator
    API.on('user:typing', (data) => {
      if (data.conversationId === Chat.getActiveConversationId()) {
        showTyping(data.handle);
      }
    });

    // Message read
    API.on('message:read', (data) => {
      if (data.conversationId === Chat.getActiveConversationId()) {
        markMessageRead(data.messageId, data.userId);
      }
    });

    // Reactions
    API.on('message:reaction_update', (data) => {
      const msg = currentMessages.find(m => m.id === data.messageId);
      if (msg) {
        msg.reactions = data.reactions;
        updateMessageElement(msg);
      }
    });

    // Context menu
    setupContextMenu();

    // Scroll to load more
    $('#messages-container').addEventListener('scroll', (e) => {
      if (e.target.scrollTop === 0 && hasMore) {
        loadMoreMessages();
      }
    });
  }

  function setupInputHandlers() {
    // Send button
    $('#send-btn').addEventListener('click', handleSend);

    // Textarea: Enter to send, Shift+Enter for newline
    const textarea = $('#message-input');
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // Auto-resize textarea
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';

      // Typing indicator
      const convId = Chat.getActiveConversationId();
      if (convId) {
        API.sendTyping(convId);
        clearTimeout(typingTimeout);
      }
    });

    // Cancel reply
    $('#cancel-reply').addEventListener('click', cancelReply);

    // Image upload
    $('#attach-btn').addEventListener('click', () => {
      $('#image-file-input').click();
    });

    $('#image-file-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      e.target.value = ''; // reset

      const convId = Chat.getActiveConversationId();
      if (!convId) return;

      try {
        // Show uploading state
        const btn = $('#attach-btn');
        btn.disabled = true;

        // Upload image to server
        const data = await API.uploadImage(file);

        // Send image message via socket
        await API.sendMessage(convId, data.url, null, replyToMessage?.id, 'image');
        cancelReply();
      } catch (err) {
        console.error('Image upload failed:', err);
        Toast.error('Failed to upload image');
      } finally {
        $('#attach-btn').disabled = false;
      }
    });
  }

  function setupEmojiPicker() {
    const btn = $('#emoji-toggle-btn');
    const picker = $('#emoji-picker');
    const input = $('#message-input');

    if (!btn || !picker || !input) return;

    // Categorized Emojis
    const emojiCategories = {
      'Smileys': ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','kb','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','mask','🤒','🤕','🤑','🤠','😈','👿'],
      'People': ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','👏','🙌','👐','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦿','🦶','👣','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁','👅','👄','💋','🩸','👶','👧','🧒','👦','👩','🧑','👨','👩‍🦱','🧑‍🦱','👨‍🦱','👩‍🦰','🧑‍🦰','👨‍🦰','👱‍♀️','👱','👱‍♂️','👩‍white','🧑‍white','👨‍white','👩‍🦲','🧑‍🦲','👨‍🦲','beard','older_woman','older_man','grandma','grandpa'],
      'Nature': ['🐶','🐱','mouse','hamster','rabbit','fox','bear','panda','koala','tiger','lion','cow','pig','frog','monkey','chicken','penguin','bird','duck','eagle','owl','bat','wolf','boar','horse','unicorn','bee','bug','butterfly','snail','ladybug','ant','mosquito','cricket','spider','web','turtle','snake','lizard','t-rex','sauropod','octopus','squid','shrimp','lobster','crab','puffer','fish','dolphin','whale','shark','seal','crocodile','leopard','zebra','gorilla','orangutan','mammoth','elephant','hippo','rhino','camel','llama','giraffe','buffalo','bull','cow2','horse2','pig2','ram','sheep','goat','deer','dog2','poodle','cat2','rooster','turkey','peacock','parrot','swan','flamingo','dove','rabbit2','raccoon','skunk','badger','otter','sloth','mouse2','rat','chipmunk','hedgehog'],
      'Food': ['grape','melon','watermelon','orange','lemon','banana','pineapple','mango','apple','green_apple','pear','peach','cherry','strawberry','blueberry','kiwi','tomato','olive','coconut','avocado','eggplant','potato','carrot','corn','pepper','cucumber','leafy_green','broccoli','garlic','onion','mushroom','peanut','chestnut','bread','croissant','baguette','pretzel','bagel','pancakes','waffle','cheese','meat','poultry','cut_of_meat','bacon','hamburger','fries','pizza','hotdog','sandwich','taco','burrito','tamale','stuffed_flatbread','falafel','egg','cooking','paella','soup','fondue','bowl','salad','popcorn','butter','salt','canned_food','bento','rice_cracker','rice_ball','rice','curry','ramen','spaghetti','yam','oden','sushi','fried_shrimp','fish_cake','dango','dumpling','fortune_cookie','takeout','crab','lobster','shrimp','squid','oyster','soft_serve','shaved_ice','ice_cream','donut','cookie','birthday','cake','cupcake','pie','chocolate','candy','lollipop','custard','honey','milk','coffee','tea','sake','champagne','wine','cocktail','tropical','beer','cheers','clinking','tumbler','pouring','ice','spoon','fork','knife','chopsticks'],
      'Activity': ['soccer','basketball','football','baseball','softball','tennis','volleyball','rugby','frisbee','ping_pong','badminton','hockey','field_hockey','lacrosse','cricket','goal','golf','bowling','target','boxing','martial_arts','climbing','fencing','horse_racing','skiing','sledding','curling','skating','snowboard','parachute','surfing','rowing','swimming','water_polo','gymnastics','lifting','cycling','biking','motor_biking','cartwheeling','wrestling','water_polo','handball','juggling','yoga','circus','skate','roller_skate','canoe','kayak','fishing','diving','astronaut','helmet'],
      'Objects': ['watch','mobile','laptop','keyboard','desktop','printer','mouse','trackball','joystick','clamp','disk','floppy','cd','dvd','abacus','camera','video_camera','vhs','projector','telephone','pager','fax','tv','radio','microphone','level','control','stopwatch','timer','clock','hourglass','satellite','battery','plug','bulb','flashlight','candle','diya','trash','oil','money','coin','yen','dollar','euro','pound','money_mouth','credit_card','gem','compass','bricks','rock','wood','hut','house','castle','stadium','school','office','post','hospital','bank','hotel','convenience','school','department','factory','shiro','castle2','wedding','tower','statue']
    };

    // Helper to get tab icon
    function getCategoryIcon(cat) {
      const map = {
        'Smileys': '😀', 'People': '👋', 'Nature': '🐶', 
        'Food': '🍔', 'Activity': '⚽', 'Objects': '💡'
      };
      return map[cat] || '😀';
    }

    // Render Tabs
    const tabsHtml = Object.keys(emojiCategories).map((cat, i) => `
      <button class="emoji-tab ${i === 0 ? 'active' : ''}" data-category="${cat}" title="${cat}">
        ${getCategoryIcon(cat)}
      </button>
    `).join('');

    // Initial Grid (Smileys)
    const initialGridHtml = emojiCategories['Smileys'].map(e => 
      `<div class="emoji-btn">${e}</div>`
    ).join('');

    picker.innerHTML = `
      <div class="emoji-tabs">${tabsHtml}</div>
      <div class="emoji-grid" id="emoji-grid">${initialGridHtml}</div>
    `;

    // Tab Switching Logic
    picker.querySelectorAll('.emoji-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        // Toggle Active Class
        picker.querySelectorAll('.emoji-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Render Category
        const cat = tab.dataset.category;
        const grid = $('#emoji-grid');
        grid.innerHTML = emojiCategories[cat].map(e => 
          `<div class="emoji-btn">${e}</div>`
        ).join('');
        grid.scrollTop = 0;
      });
    });

    // Toggle picker
    btn.addEventListener('click', () => {
      picker.classList.toggle('hidden');
      btn.classList.toggle('active');
    });

    // Insert emoji (delegated)
    picker.addEventListener('click', (e) => {
      if (e.target.classList.contains('emoji-btn')) {
        const char = e.target.textContent;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const text = input.value;
        input.value = text.substring(0, start) + char + text.substring(end);
        input.focus();
        input.selectionStart = input.selectionEnd = start + char.length;
      }
    });
  }

  async function loadMessages(convId) {
    currentMessages = [];
    hasMore = false;
    nextCursor = null;
    $('#messages-list').innerHTML = '';

    try {
      const data = await API.getMessages(convId);
      currentMessages = data.messages || [];
      hasMore = data.hasMore;
      nextCursor = data.nextCursor;

      renderAllMessages();
      scrollToBottom(false);
      handleEncryptedMedia(); // Decrypt images after render

      // Mark last message as read
      if (currentMessages.length > 0) {
        const lastMsg = currentMessages[currentMessages.length - 1];
        API.markRead(convId, lastMsg.id);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }

  async function loadMoreMessages() {
    const convId = Chat.getActiveConversationId();
    if (!convId || !hasMore || !nextCursor) return;

    const container = $('#messages-container');
    const prevScrollHeight = container.scrollHeight;

    try {
      const data = await API.getMessages(convId, nextCursor);
      const older = data.messages || [];
      hasMore = data.hasMore;
      nextCursor = data.nextCursor;

      currentMessages = [...older, ...currentMessages];
      renderAllMessages();

      // Maintain scroll position
      container.scrollTop = container.scrollHeight - prevScrollHeight;
    } catch (err) {
      console.error('Failed to load more:', err);
    }
  }

  function renderAllMessages() {
    const list = $('#messages-list');
    const userId = App.currentUser?.id;
    let lastDate = '';

    list.innerHTML = currentMessages.map((msg, i) => {
      let html = '';

      // Date separator
      const msgDate = new Date(msg.createdAt).toLocaleDateString();
      if (msgDate !== lastDate) {
        lastDate = msgDate;
        const dateLabel = formatDateLabel(msg.createdAt);
        html += `<div class="date-separator"><span>${dateLabel}</span></div>`;
      }

      // Grouping Logic
      const prev = currentMessages[i - 1];
      const next = currentMessages[i + 1];
      const isMine = msg.senderId === userId || msg.sender?.id === userId;
      
      const prevIsSame = prev && (prev.senderId === msg.senderId || prev.sender?.id === msg.sender?.id) && (new Date(msg.createdAt) - new Date(prev.createdAt) < 120000); // 2 mins
      const nextIsSame = next && (next.senderId === msg.senderId || next.sender?.id === msg.sender?.id) && (new Date(next.createdAt) - new Date(msg.createdAt) < 120000);

      let groupClass = '';
      if (!prevIsSame && nextIsSame) groupClass = 'group-start';
      else if (prevIsSame && nextIsSame) groupClass = 'group-middle';
      else if (prevIsSame && !nextIsSame) groupClass = 'group-end';
      
      // If it's a single message (neither prev nor next is same), it remains empty (default radius)

      html += renderMessage(msg, userId, groupClass);
      return html;
    }).join('');

    // Bind Long Press & Double Click
    list.querySelectorAll('.message').forEach(el => {
      const msgId = el.dataset.msgId;
      setupLongPress(el, msgId);
      
      // Double click for heart (classic UX)
      el.addEventListener('dblclick', () => toggleReaction(msgId, '❤️'));
    });
  }

  function renderMessage(msg, userId, groupClass = '') {
    const isOutgoing = msg.senderId === userId || msg.sender?.id === userId;
    const isDeleted = !!msg.deletedAt;
    const senderName = msg.sender?.displayName || msg.sender?.handle || 'Unknown';
    const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgType = msg.type || 'text';

    // Decrypt if needed
    let body = msg.body;
    if (msg.nonce && !isDeleted && msgType === 'text') {
      body = CryptoClient.decrypt(msg.body, msg.nonce, msg.conversationId, msg.counter || 0);
    }

    const conv = Chat.getConversation(msg.conversationId || Chat.getActiveConversationId());
    // Only show sender if it's a group, not me, AND it's the start of a group (or single)
    const showSender = conv && conv.type === 'group' && !isOutgoing && (groupClass === 'group-start' || groupClass === '');

    // Render body based on type
    let bodyHtml;
    if (isDeleted) {
      bodyHtml = '🗑️ Message deleted';
    } else if (msgType === 'image') {
      const fileUrl = msg.media ? API.pb.files.getUrl(msg, msg.media) : body;
      bodyHtml = `
        <div class="image-wrapper-enc" data-msg-id="${msg.id}" data-url="${fileUrl}" data-nonce="${msg.nonce}" data-counter="${msg.counter || 0}">
          <div class="img-skeleton">🔒 Decrypting...</div>
          <img src="" class="message-image hidden" alt="Image" onclick="Messages.openImagePreview(this.src)">
        </div>
      `;
    } else {
      bodyHtml = Chat.escapeHtml(body);
    }

    // Render reactions
    let reactionsHtml = '';
    if (msg.reactions && msg.reactions.length > 0) {
      // Group by emoji
      const groups = {};
      msg.reactions.forEach(r => {
        if (!groups[r.emoji]) groups[r.emoji] = { count: 0, hasMe: false, users: [] };
        groups[r.emoji].count++;
        if (r.userId === App.currentUser?.id) groups[r.emoji].hasMe = true;
        groups[r.emoji].users.push(r.user?.displayName || 'Unknown');
      });

      reactionsHtml = '<div class="message-reactions">';
      for (const [emoji, meta] of Object.entries(groups)) {
        reactionsHtml += `
          <button class="reaction-badge ${meta.hasMe ? 'active' : ''}" 
                  onclick="Messages.toggleReaction('${msg.id}', '${emoji}')"
                  title="${meta.users.join(', ')}">
            ${emoji} <span class="reaction-count">${meta.count}</span>
          </button>
        `;
      }
      reactionsHtml += '</div>';
    }

    // SVG Ticks
    const checkIcon = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M12.3 3.3a1 1 0 0 1 1.4 1.4l-6.5 6.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 0 1 1.4-1.4l2.8 2.8 5.8-5.8z"/></svg>`;
    const doubleCheckIcon = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M12.3 3.3a1 1 0 0 1 1.4 1.4l-6.5 6.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 0 1 1.4-1.4l2.8 2.8 5.8-5.8z"/><path d="M16.3 3.3a1 1 0 0 1 1.4 1.4l-6.5 6.5a1 1 0 0 1-1.4 0l-1-1 1.4-1.4 1.1 1.1 5-5-1.4-1.4z" style="display:none"/></svg>`; // Simplified double check for now, or just use two paths.
    
    // Better Double Check SVG
    const ticksSvg = `
      <div class="message-status-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 12L10 17L20 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tick-1"/>
          <path d="M13 17L23 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tick-2" style="display:none"/>
        </svg>
      </div>
    `;

    return `
      <div class="message-wrapper ${isOutgoing ? 'outgoing' : 'incoming'} ${groupClass} ${msg.reactions?.length ? 'has-reactions' : ''}">
        <div class="message ${isOutgoing ? 'outgoing' : 'incoming'} ${isDeleted ? 'deleted' : ''}" 
             data-msg-id="${msg.id}" 
             data-sender-id="${msg.senderId || msg.sender?.id}"
             data-msg-type="${msgType}"
             data-body="${msgType === 'text' ? Chat.escapeHtml(body) : body}">
          ${showSender ? `<div class="message-sender">${Chat.escapeHtml(senderName)}</div>` : ''}
          <div class="message-body">${bodyHtml}</div>
          <div class="message-meta">
            ${msg.editedAt && !isDeleted ? '<span class="message-edited">edited</span>' : ''}
            <span class="message-time">${time}</span>
            ${isOutgoing && !isDeleted ? ticksSvg : ''}
          </div>
          
          <div class="reaction-picker-trigger">
            <button onclick="event.stopPropagation(); Messages.showReactionPicker(this, '${msg.id}')">😊</button>
          </div>
        </div>
        ${reactionsHtml}
      </div>
    `;
  }

  async function handleEncryptedMedia() {
    const containers = document.querySelectorAll('.image-wrapper-enc:not(.decrypted)');
    for (const container of containers) {
      const msgId = container.dataset.msgId;
      const url = container.dataset.url;
      const nonce = container.dataset.nonce;
      const counter = parseInt(container.dataset.counter || '0');
      const convId = Chat.getActiveConversationId();

      try {
        container.classList.add('decrypted');
        const response = await fetch(url);
        const encryptedBlob = await response.blob();
        
        const decryptedBlob = await CryptoClient.decryptFile(encryptedBlob, nonce, convId, counter);
        const objectUrl = URL.createObjectURL(decryptedBlob);
        
        const img = container.querySelector('img');
        img.src = objectUrl;
        img.classList.remove('hidden');
        container.querySelector('.img-skeleton').remove();
      } catch (err) {
        console.error('Failed to decrypt media:', err);
        container.querySelector('.img-skeleton').textContent = '❌ Decryption error';
      }
    }
  }

  // --- Long Press for Mobile ---
  let pressTimer;
  function setupLongPress(el, messageId) {
    el.addEventListener('touchstart', (e) => {
      pressTimer = setTimeout(() => {
        vibrate(50);
        showReactionPicker(el, messageId);
      }, 500);
    });
    el.addEventListener('touchend', () => clearTimeout(pressTimer));
    el.addEventListener('touchmove', () => clearTimeout(pressTimer));
  }

  function vibrate(ms) {
    if ('vibrate' in navigator) navigator.vibrate(ms);
  }

  function addMessage(msg) {
    const userId = App.currentUser?.id;
    
    // Keep in memory
    if (!currentMessages.find(m => m.id === msg.id)) {
      currentMessages.push(msg);
    }
    
    // Memory Optimization: Keep only the latest N messages
    if (currentMessages.length > MAX_MESSAGES_IN_MEMORY) {
      currentMessages.shift(); // Remove oldest
    }
    
    // Re-render all to apply grouping logic correctly
    renderAllMessages();
  }

  function updateMessage(msg) {
    const el = document.querySelector(`[data-msg-id="${msg.id}"]`);
    if (!el) return;

    let body = msg.body;
    if (msg.nonce) body = CryptoClient.decrypt(msg.body, msg.nonce, msg.conversationId);

    el.querySelector('.message-body').textContent = body;
    el.dataset.body = body;

    // Add edited indicator
    const meta = el.querySelector('.message-meta');
    if (!meta.querySelector('.message-edited')) {
      meta.insertAdjacentHTML('afterbegin', '<span class="message-edited">edited</span>');
    }

    // Update in memory
    const idx = currentMessages.findIndex(m => m.id === msg.id);
    if (idx !== -1) currentMessages[idx] = msg;
  }

  function removeMessage(messageId) {
    const el = document.querySelector(`[data-msg-id="${messageId}"]`);
    if (el) {
      el.classList.add('deleted');
      el.querySelector('.message-body').textContent = '🗑️ Message deleted';
      el.dataset.body = '';
    }
  }

  function markMessageRead(messageId, readByUserId) {
    const wrapper = document.querySelector(`[data-msg-id="${messageId}"]`);
    if (wrapper) {
      const statusIcon = wrapper.querySelector('.message-status-icon');
      if (statusIcon) {
        statusIcon.classList.add('read');
      }
    }
    
    // Also update all previous unread messages if bulk update (optimized)
    // For now, just simplistic update
    const allStatusIcons = document.querySelectorAll('.message.outgoing .message-status-icon:not(.read)');
    allStatusIcons.forEach(el => el.classList.add('read'));
  }

  // --- Image preview ---
  function openImagePreview(src) {
    const overlay = document.createElement('div');
    overlay.className = 'image-preview-overlay';
    overlay.innerHTML = `
      <div class="image-preview-container">
        <img src="${src}" alt="Preview">
        <button class="image-preview-close">✕</button>
      </div>
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.classList.contains('image-preview-close')) {
        overlay.remove();
      }
    });
    document.body.appendChild(overlay);
  }

  // --- Send / Edit ---
  async function handleSend() {
    const textarea = $('#message-input');
    const text = textarea.value.trim();
    if (!text) return;

    const convId = Chat.getActiveConversationId();
    if (!convId) return;

    textarea.value = '';
    textarea.style.height = 'auto';

    try {
      if (editingMessageId) {
        // Edit mode
        const { ciphertext, nonce } = CryptoClient.encrypt(text, convId);
        await API.editMessage(editingMessageId, ciphertext, nonce);
        cancelEdit();
      } else {
        // Normal send
        const { ciphertext, nonce } = CryptoClient.encrypt(text, convId);
        await API.sendMessage(convId, ciphertext, nonce, replyToMessage?.id, 'text');
        cancelReply();
      }
    } catch (err) {
      console.error('Send failed:', err);
      textarea.value = text; // Restore on failure
    }
  }

  // --- Reply ---
  function setReply(msg) {
    replyToMessage = msg;
    const preview = $('#reply-preview');
    preview.classList.remove('hidden');
    preview.querySelector('.reply-author').textContent = msg.sender?.displayName || msg.sender?.handle || 'Unknown';
    preview.querySelector('.reply-text').textContent = (msg.type === 'image' ? '📷 Photo' : msg.body?.substring(0, 80)) || '';
    $('#message-input').focus();
  }

  function cancelReply() {
    replyToMessage = null;
    $('#reply-preview').classList.add('hidden');
  }

  // --- Edit ---
  function startEdit(msgId) {
    const msg = currentMessages.find(m => m.id === msgId);
    if (!msg || msg.type === 'image') return; // Can't edit images

    editingMessageId = msgId;
    let body = msg.body;
    if (msg.nonce) body = CryptoClient.decrypt(msg.body, msg.nonce, msg.conversationId);

    const textarea = $('#message-input');
    textarea.value = body;
    textarea.focus();
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
  }

  function cancelEdit() {
    editingMessageId = null;
    $('#message-input').value = '';
  }

  // --- Context Menu ---
  function setupContextMenu() {
    const menu = $('#context-menu');

    // Right-click on messages
    document.addEventListener('contextmenu', (e) => {
      const msgEl = e.target.closest('.message');
      if (!msgEl || msgEl.classList.contains('deleted')) return;

      e.preventDefault();
      contextTarget = msgEl;

      const isOutgoing = msgEl.classList.contains('outgoing');
      const isImage = msgEl.dataset.msgType === 'image';
      menu.querySelector('[data-action="edit"]').style.display = isOutgoing && !isImage ? '' : 'none';
      menu.querySelector('[data-action="delete"]').style.display = isOutgoing ? '' : 'none';
      menu.querySelector('[data-action="copy"]').style.display = isImage ? 'none' : '';

      // Position
      const x = Math.min(e.clientX, window.innerWidth - 180);
      const y = Math.min(e.clientY, window.innerHeight - 200);
      menu.style.left = x + 'px';
      menu.style.top = y + 'px';
      menu.classList.remove('hidden');
    });

    // Close context menu
    document.addEventListener('click', () => {
      menu.classList.add('hidden');
      contextTarget = null;
    });

    // Context menu actions
    menu.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!contextTarget) return;
        const msgId = contextTarget.dataset.msgId;
        const action = btn.dataset.action;

        switch (action) {
          case 'reply': {
            const msg = currentMessages.find(m => m.id === msgId);
            if (msg) setReply(msg);
            break;
          }
          case 'edit':
            startEdit(msgId);
            break;
          case 'delete':
            if (confirm('Delete this message?')) {
              API.deleteMessage(msgId);
            }
            break;
          case 'copy': {
            const body = contextTarget.dataset.body;
            navigator.clipboard.writeText(body).catch(() => {});
            break;
          }
        }

        menu.classList.add('hidden');
        contextTarget = null;
      });
    });
  }

  // --- Typing ---
  let typingHideTimeout;
  function showTyping(handle) {
    const el = $('#typing-indicator');
    $('#typing-user').textContent = handle;
    el.classList.remove('hidden');

    clearTimeout(typingHideTimeout);
    typingHideTimeout = setTimeout(() => {
      el.classList.add('hidden');
    }, 3000);
  }

  // --- Helpers ---
  function scrollToBottom(smooth = true) {
    const container = $('#messages-container');
    if (!container) return;
    setTimeout(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }, 50);
  }

  function formatDateLabel(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    const dayMs = 86400000;

    if (diff < dayMs && d.getDate() === now.getDate()) return 'Today';
    if (diff < 2 * dayMs) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  }

  // --- Reactions ---
  async function toggleReaction(msgId, emoji) {
    const msg = currentMessages.find(m => m.id === msgId);
    if (!msg) return;

    if (!msg.reactions) msg.reactions = [];
    const myId = App.currentUser?.id;
    const existing = msg.reactions.find(r => r.userId === myId && r.emoji === emoji);

    try {
      if (existing) {
        // Remove
        await API.removeReaction(msgId, emoji);
        // Optimistic update handled by socket event, but we can do it here too if latency is high
      } else {
        // Add
        await API.addReaction(msgId, emoji);
      }
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  }

  function addReactionToUI(msgId, reaction) {
    const msg = currentMessages.find(m => m.id === msgId);
    if (!msg) return;

    if (!msg.reactions) msg.reactions = [];
    if (!msg.reactions.find(r => r.id === reaction.id)) {
      msg.reactions.push(reaction);
      updateMessageElement(msg);
    }
  }

  function removeReactionFromUI(msgId, userId, emoji) {
    const msg = currentMessages.find(m => m.id === msgId);
    if (!msg) return;

    if (msg.reactions) {
      msg.reactions = msg.reactions.filter(r => !(r.userId === userId && r.emoji === emoji));
      updateMessageElement(msg);
    }
  }

  function showReactionPicker(btn, msgId) {
    // Remove existing
    $('.reaction-popup')?.remove();
    $('.reaction-picker-trigger.active')?.classList.remove('active');

    const emojis = ['👍', '👎', '❤️', '🔥', '😂', '😮', '😢', '🙏'];
    const popup = document.createElement('div');
    popup.className = 'reaction-popup';
    popup.innerHTML = emojis.map(e => 
      `<button onclick="Messages.toggleReaction('${msgId}', '${e}'); this.parentElement.remove()">${e}</button>`
    ).join('');

    document.body.appendChild(popup);
    
    // Smart Positioning
    const rect = btn.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    let top = rect.top - popupRect.height - 8;
    let left = rect.left;
    let transformOrigin = 'bottom left';

    // If too close to top, show below
    if (top < 10) {
      top = rect.bottom + 8;
      transformOrigin = 'top left';
      popup.classList.add('position-below');
    }

    // If too close to right edge, shift left
    if (left + popupRect.width > viewportWidth - 20) {
      left = viewportWidth - popupRect.width - 20;
      transformOrigin = transformOrigin.replace('left', 'right');
    }

    // If too close to left edge (unlikely but possible)
    if (left < 10) {
      left = 10;
    }

    popup.style.top = top + 'px';
    popup.style.left = left + 'px';
    popup.style.transformOrigin = transformOrigin;
    
    // Add active class to button for styling
    btn.classList.add('active');

    // Close logic (Global)
    const closePopup = (e) => {
      if (!popup.contains(e.target) && e.target !== btn) {
        popup.remove();
        btn.classList.remove('active');
        document.removeEventListener('pointerdown', closePopup);
      }
    };
    
    // Use pointerdown for faster response
    setTimeout(() => document.addEventListener('pointerdown', closePopup), 10);
  }

  function updateMessageElement(msg) {
    const el = document.querySelector(`[data-msg-id="${msg.id}"]`);
    if (!el) return;
    
    const wrapper = el.closest('.message-wrapper');
    if (!wrapper) return;

    // Preserve grouping class
    const groupClasses = ['group-start', 'group-middle', 'group-end'];
    const activeGroupClass = groupClasses.find(c => wrapper.classList.contains(c)) || '';
    
    const userId = App.currentUser?.id;
    const newHtml = renderMessage(msg, userId, activeGroupClass).trim();
    
    wrapper.outerHTML = newHtml;
  }

  return { 
    init, loadMessages, addMessage, scrollToBottom, openImagePreview, 
    toggleReaction, showReactionPicker, updateMessageElement
  };
})();
