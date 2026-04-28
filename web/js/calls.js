/**
 * CryptMessenger — Advanced WebRTC Calls Controller (v2.0)
 * Implements: PiP, Quick Replies with Custom Text, Wake Lock, and Full Screen Intent.
 */
const Calls = (() => {
  const $ = (s) => document.querySelector(s);
  
  let localStream = null;
  let peerConnection = null;
  let currentCall = null; 
  let isIncoming = false;
  let callStartTime = null;
  let callTimer = null;
  let reconnectionTimeout = null;
  let wakeLock = null;

  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  function init() {
    // --- UI Listeners ---
    $('#audio-call-btn').addEventListener('click', () => startCall('audio'));
    $('#video-call-btn').addEventListener('click', () => startCall('video'));
    $('#hangup-btn').addEventListener('click', hangup);
    $('#reject-call-btn').addEventListener('click', () => stopAll(true));
    $('#accept-call-btn').addEventListener('click', acceptCall);
    
    $('#toggle-mic-btn').addEventListener('click', toggleMic);
    $('#toggle-video-btn').addEventListener('click', handleToggleVideo);
    $('#pip-btn').addEventListener('click', togglePiP);
    
    // Quick Reply
    $('#quick-reply-btn').addEventListener('click', openQuickReply);
    $('#close-quick-reply').addEventListener('click', closeQuickReply);
    $('#send-custom-reply').addEventListener('click', () => {
      const text = $('#custom-reply-input').value;
      if (text.trim()) sendQuickReply(text);
    });
    document.querySelectorAll('.quick-reply-opt').forEach(opt => {
      opt.addEventListener('click', () => sendQuickReply(opt.textContent));
    });

    // --- Socket Listeners ---
    API.on('call:received', handleIncomingCall);
    API.on('call:answered', handleCallAnswered);
    API.on('call:ice_candidate', handleNewICECandidate);
    API.on('call:ended', () => stopAll(false));
    API.on('call:video_requested', handleVideoRequested);
    API.on('call:video_responded', handleVideoResponded);
  }

  function vibrate(pattern = 50) {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  }

  async function requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
      } catch (err) { console.error('WakeLock failed:', err); }
    }
  }

  function releaseWakeLock() {
    if (wakeLock) {
      wakeLock.release();
      wakeLock = null;
    }
  }

  async function startCall(type) {
    vibrate(60);
    const convId = Chat.getActiveConversationId();
    if (!convId) return;

    const conv = Chat.getConversation(convId);
    const otherMember = conv.members.find(m => m.id !== App.currentUser.id);
    if (!otherMember) return;

    currentCall = { to: otherMember.id, type, conversationId: convId };
    isIncoming = false;

    showCallUI(otherMember.displayName || otherMember.handle, type, false);
    updateCallStatus('Набор номера...');
    requestWakeLock();

    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: type === 'video'
      });
      $('#local-video').srcObject = localStream;
      if (type === 'audio') $('#local-video').classList.add('hidden');
      else $('#local-video').classList.remove('hidden');

      createPeerConnection(otherMember.id);
      localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      API.emit('call_user', { to: otherMember.id, offer, type, conversationId: convId });

      setTimeout(() => {
        if (currentCall && !callStartTime) updateCallStatus('Вызов...');
      }, 2000);
    } catch (err) { stopAll(false); }
  }

  function handleIncomingCall(data) {
    if (currentCall) {
      API.emit('hangup', { to: data.from });
      return;
    }

    vibrate([200, 100, 200]);
    currentCall = { to: data.from, type: data.type, conversationId: data.conversationId, offer: data.offer };
    isIncoming = true;

    showCallUI(data.fromHandle, data.type, true);
    requestWakeLock();
    
    // Attempt full screen on incoming call for "Locked Screen" effect
    if (document.documentElement.requestFullscreen) {
       // Note: Most browsers require a user gesture for full screen.
       // We can't auto-fullscreen, but we can suggest it or do it on first interaction.
    }
  }

  async function acceptCall() {
    vibrate(50);
    if (!currentCall || !currentCall.offer) return;

    $('#incoming-call-actions').classList.add('hidden');
    updateCallStatus('Подключение...');

    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: currentCall.type === 'video'
      });
      $('#local-video').srcObject = localStream;
      if (currentCall.type === 'audio') $('#local-video').classList.add('hidden');

      createPeerConnection(currentCall.to);
      localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

      await peerConnection.setRemoteDescription(new RTCSessionDescription(currentCall.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      API.emit('answer_call', { to: currentCall.to, answer });
      startTimer();
    } catch (err) { stopAll(false); }
  }

  async function handleCallAnswered(data) {
    if (!peerConnection) return;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    updateCallStatus('Соединение установлено');
    startTimer();
  }

  function handleNewICECandidate(data) {
    if (peerConnection) {
      peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(console.error);
    }
  }

  function createPeerConnection(remoteUserId) {
    peerConnection = new RTCPeerConnection(configuration);

    peerConnection.onicecandidate = (e) => {
      if (e.candidate) API.emit('ice_candidate', { to: remoteUserId, candidate: e.candidate });
    };

    peerConnection.ontrack = (e) => {
      $('#remote-video').srcObject = e.streams[0];
      $('#call-avatar').classList.add('hidden');
      updateCallStatus('Разговор');
      setupMediaSession();
    };

    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState;
      if (state === 'disconnected') {
        updateCallStatus('⚠️ Плохое соединение...');
        reconnectionTimeout = setTimeout(() => {
           if (peerConnection.iceConnectionState === 'disconnected') stopAll(true, 'network_loss');
        }, 15000);
      } 
      if (state === 'connected' || state === 'completed') {
        clearTimeout(reconnectionTimeout);
        updateCallStatus(getDuration());
      }
    };

    peerConnection.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(peerConnection.connectionState)) stopAll(false);
    };
  }

  function setupMediaSession() {
    if ('mediaSession' in navigator && currentCall) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `Разговор: ${$('#call-user-name').textContent}`,
        artist: 'CryptMessenger',
        artwork: [{ src: 'https://cdn-icons-png.flaticon.com/512/3662/3662817.png', sizes: '512x512', type: 'image/png' }]
      });
      navigator.mediaSession.playbackState = 'playing';
      navigator.mediaSession.setActionHandler('hangup', hangup);
    }
  }

  async function togglePiP() {
    const video = $('#remote-video');
    if (!video.srcObject) return;
    
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch (err) { console.error('PiP failed:', err); }
  }

  async function handleToggleVideo() {
    if (!currentCall || !localStream) return;
    if (currentCall.type === 'audio') {
      Toast.info('Запрашиваем видео...');
      API.emit('request_video', { to: currentCall.to });
    } else {
      localStream.getVideoTracks()[0].enabled = false;
      currentCall.type = 'audio';
      $('#local-video').classList.add('hidden');
      $('#toggle-video-btn').textContent = '📵';
      Toast.info('Видео отключено');
    }
  }

  function handleVideoRequested(data) {
    if (confirm(`Собеседник хочет включить видео. Разрешить?`)) {
      API.emit('respond_video', { to: data.from, accept: true });
      switchToVideo();
    } else {
      API.emit('respond_video', { to: data.from, accept: false });
    }
  }

  async function handleVideoResponded(data) {
    if (data.accept) {
      Toast.success('Видео принято!');
      await switchToVideo();
    } else { Toast.error('Отклонено'); }
  }

  async function switchToVideo() {
    try {
      localStream.getTracks().forEach(t => t.stop());
      localStream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, 
        video: true 
      });
      $('#local-video').srcObject = localStream;
      $('#local-video').classList.remove('hidden');
      $('#toggle-video-btn').textContent = '📹';
      currentCall.type = 'video';
      
      const videoTrack = localStream.getVideoTracks()[0];
      const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
      if (sender) sender.replaceTrack(videoTrack);
      else peerConnection.addTrack(videoTrack, localStream);
    } catch (err) { console.error(err); }
  }

  function openQuickReply() { $('#quick-reply-drawer').classList.add('active'); }
  function closeQuickReply() { 
    $('#quick-reply-drawer').classList.remove('active'); 
    $('#custom-reply-input').value = '';
  }

  async function sendQuickReply(text) {
    if (!currentCall) return;
    const conversationId = currentCall.conversationId;
    stopAll(true);
    try {
      await API.sendMessage(conversationId, `[Автоответ] ${text}`);
      Toast.info('Отправлено');
    } catch (err) { console.error(err); }
  }

  function hangup() { stopAll(true); }

  function stopAll(wasInitiator = false, reason = null) {
    if (wasInitiator && currentCall) API.emit('hangup', { to: currentCall.to });

    const duration = getDuration();
    const typeLabel = currentCall?.type === 'video' ? 'Видеозвонок' : 'Аудиозвонок';
    const convId = currentCall?.conversationId;

    if (reason === 'network_loss' && convId) API.sendMessage(convId, `⚠️ Звонок прервался`).catch(console.error);
    else if (callStartTime && convId) API.sendMessage(convId, `📞 ${typeLabel}, ${duration}`).catch(console.error);
    else if (convId && isIncoming && wasInitiator) API.sendMessage(convId, `📵 Пропущенный вызов`).catch(console.error);

    if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
    if (peerConnection) { peerConnection.close(); peerConnection = null; }
    if (document.pictureInPictureElement) document.exitPictureInPicture();
    
    releaseWakeLock();
    clearTimeout(reconnectionTimeout);
    clearInterval(callTimer);
    callStartTime = null;
    currentCall = null;
    isIncoming = false;

    $('#call-overlay').classList.add('hidden');
    $('#call-avatar').classList.remove('avatar-pulsing');
    closeQuickReply();
  }

  function startTimer() {
    callStartTime = Date.now();
    callTimer = setInterval(() => updateCallStatus(getDuration()), 1000);
  }

  function getDuration() {
    if (!callStartTime) return '00:00';
    const sec = Math.floor((Date.now() - callStartTime) / 1000);
    return `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;
  }

  function showCallUI(name, type, incoming) {
    $('#call-overlay').classList.remove('hidden');
    $('#call-user-name').textContent = name;
    $('#call-avatar').textContent = Chat.getInitials(name);
    $('#call-avatar').style.background = Chat.getAvatarColor(name);
    $('#call-avatar').classList.add('avatar-pulsing');
    
    // Background blur simulation
    $('#call-bg-blur').style.backgroundImage = `linear-gradient(135deg, ${Chat.getAvatarColor(name)}, #000)`;

    $('#incoming-call-actions').classList.toggle('hidden', !incoming);
    $('#call-controls').classList.toggle('hidden', incoming);
    $('#pip-btn').classList.toggle('hidden', type !== 'video');
    
    if (type === 'audio') $('#remote-video').classList.add('hidden');
    else $('#remote-video').classList.remove('hidden');
  }

  function updateCallStatus(text) { $('#call-status-text').textContent = text; }

  function toggleMic() {
    if (!localStream) return;
    const track = localStream.getAudioTracks()[0];
    track.enabled = !track.enabled;
    $('#toggle-mic-btn').textContent = track.enabled ? '🎙️' : '🔇';
    $('#toggle-mic-btn').classList.toggle('btn-danger', !track.enabled);
  }

  return { init };
})();
