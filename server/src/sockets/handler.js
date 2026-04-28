import { prisma } from '../server.js';
import { authenticateSocket } from '../middleware/auth.js';

// Track online users: userId -> Set of socket IDs
const onlineUsers = new Map();

export function setupSocketHandlers(io, fastify) {

  // --- Auth middleware ---
  io.use(authenticateSocket(fastify));

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`🟢 ${socket.userHandle} connected (${socket.id})`);

    // Track online status
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    // Join personal room + all conversation rooms
    socket.join(`user:${userId}`);
    const memberships = await prisma.member.findMany({
      where: { userId },
      select: { conversationId: true }
    });
    for (const m of memberships) {
      socket.join(`conv:${m.conversationId}`);
    }

    // Broadcast online status to everyone
    broadcastPresence(io, userId, true);

    // Send current online list to this socket
    const onlineList = Array.from(onlineUsers.keys());
    socket.emit('presence_list', onlineList);

    // --- Send Message ---
    socket.on('send_message', async (data, ack) => {
      try {
        const { conversationId, body, nonce, replyToId, type } = data;

        // Verify membership
        const member = await prisma.member.findUnique({
          where: { conversationId_userId: { conversationId, userId } }
        });
        if (!member) return ack?.({ error: 'Not a member' });

        // Save message
        const message = await prisma.message.create({
          data: {
            conversationId,
            senderId: userId,
            body,
            nonce,
            replyToId,
            type: type || 'text'
          },
          include: { sender: { select: { id: true, handle: true, displayName: true } } }
        });

        // Update conversation timestamp
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() }
        });

        // FIX: Send to EACH member's personal room (not just conv room)
        // This ensures delivery even if they haven't joined the conv room yet
        const members = await prisma.member.findMany({
          where: { conversationId },
          select: { userId: true }
        });
        for (const m of members) {
          io.to(`user:${m.userId}`).emit('new_message', message);
        }

        ack?.({ message });
      } catch (err) {
        console.error('send_message error:', err);
        ack?.({ error: 'Failed to send message' });
      }
    });

    // --- Reactions ---
    socket.on('message_reaction', async (data) => {
      const { messageId, emoji } = data;
      try {
        const msg = await prisma.message.findUnique({ where: { id: messageId } });
        if (!msg) return;

        // Toggle reaction: if exists, remove; if not, add
        const existing = await prisma.reaction.findUnique({
          where: { messageId_userId_emoji: { messageId, userId, emoji } }
        });

        if (existing) {
          await prisma.reaction.delete({ where: { id: existing.id } });
        } else {
          await prisma.reaction.create({
            data: { messageId, userId, emoji }
          });
        }

        // Get all reactions for this message to broadcast
        const allReactions = await prisma.reaction.findMany({
          where: { messageId },
          include: { user: { select: { handle: true, displayName: true } } }
        });

        io.to(`conv:${msg.conversationId}`).emit('message:reaction_update', {
          messageId,
          reactions: allReactions
        });
      } catch (err) {
        console.error('Reaction error:', err);
      }
    });

    // --- Edit Message ---
    socket.on('edit_message', async (data, ack) => {
      try {
        const { messageId, body, nonce } = data;

        const message = await prisma.message.findUnique({ where: { id: messageId } });
        if (!message || message.senderId !== userId) {
          return ack?.({ error: 'Cannot edit this message' });
        }

        const updated = await prisma.message.update({
          where: { id: messageId },
          data: { body, nonce, editedAt: new Date() },
          include: { sender: { select: { id: true, handle: true, displayName: true } } }
        });

        const members = await prisma.member.findMany({
          where: { conversationId: message.conversationId },
          select: { userId: true }
        });
        for (const m of members) {
          io.to(`user:${m.userId}`).emit('message_edited', updated);
        }
        ack?.({ message: updated });
      } catch (err) {
        ack?.({ error: 'Failed to edit' });
      }
    });

    // --- Delete Message ---
    socket.on('delete_message', async (data, ack) => {
      try {
        const { messageId } = data;

        const message = await prisma.message.findUnique({ where: { id: messageId } });
        if (!message || message.senderId !== userId) {
          return ack?.({ error: 'Cannot delete this message' });
        }

        await prisma.message.update({
          where: { id: messageId },
          data: { deletedAt: new Date(), body: '' }
        });

        const members = await prisma.member.findMany({
          where: { conversationId: message.conversationId },
          select: { userId: true }
        });
        for (const m of members) {
          io.to(`user:${m.userId}`).emit('message_deleted', {
            messageId, conversationId: message.conversationId
          });
        }
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ error: 'Failed to delete' });
      }
    });

    // --- Typing indicator ---
    socket.on('typing', (data) => {
      const { conversationId } = data;
      socket.to(`conv:${conversationId}`).emit('user_typing', {
        userId, handle: socket.userHandle, conversationId
      });
    });

    // --- Mark as read ---
    socket.on('mark_read', async (data) => {
      const { conversationId, messageId } = data;

      await prisma.readCursor.upsert({
        where: { conversationId_userId: { conversationId, userId } },
        update: { lastReadMessageId: messageId },
        create: { conversationId, userId, lastReadMessageId: messageId }
      });

      socket.to(`conv:${conversationId}`).emit('message_read', {
        userId, conversationId, messageId
      });
    });

    // --- Join conversation room (when creating new conv) ---
    socket.on('join_conversation', (data) => {
      socket.join(`conv:${data.conversationId}`);
    });

    // --- WebRTC Signaling ---
    socket.on('call_user', (data) => {
      const { to, offer, type, conversationId } = data;
      io.to(`user:${to}`).emit('call_received', {
        from: userId,
        fromHandle: socket.userHandle,
        offer,
        type,
        conversationId
      });
    });

    socket.on('answer_call', (data) => {
      const { to, answer } = data;
      io.to(`user:${to}`).emit('call_answered', {
        from: userId,
        answer
      });
    });

    socket.on('ice_candidate', (data) => {
      const { to, candidate } = data;
      io.to(`user:${to}`).emit('ice_candidate', {
        from: userId,
        candidate
      });
    });

    socket.on('hangup', (data) => {
      const { to } = data;
      io.to(`user:${to}`).emit('call_ended', { from: userId });
    });

    socket.on('request_video', (data) => {
      const { to } = data;
      io.to(`user:${to}`).emit('video_requested', { from: userId });
    });

    socket.on('respond_video', (data) => {
      const { to, accept } = data;
      io.to(`user:${to}`).emit('video_responded', { from: userId, accept });
    });

    socket.on('key_rotation', (data) => {
      const { to, seed } = data;
      io.to(`user:${to}`).emit('key_rotated', { from: userId, seed });
    });

    // --- Disconnect ---
    socket.on('disconnect', () => {
      console.log(`🔴 ${socket.userHandle} disconnected`);
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          broadcastPresence(io, userId, false);
        }
      }
    });
  });
}

function broadcastPresence(io, userId, isOnline) {
  io.emit('presence', { userId, online: isOnline });
}
