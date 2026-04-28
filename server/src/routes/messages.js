import { prisma } from '../server.js';

export default async function messageRoutes(fastify) {

  // --- Get messages for a conversation (paginated) ---
  fastify.get('/:id/messages', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const myId = request.user.id;
    const convId = request.params.id;
    const { cursor, limit = 50 } = request.query;

    // Verify membership
    const member = await prisma.member.findUnique({
      where: { conversationId_userId: { conversationId: convId, userId: myId } }
    });
    if (!member) return reply.status(403).send({ error: 'Not a member' });

    const messages = await prisma.message.findMany({
      where: {
        conversationId: convId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit), 100),
      include: {
        sender: { select: { id: true, handle: true, displayName: true } },
        reactions: {
          select: {
            id: true,
            emoji: true,
            userId: true,
            user: { select: { handle: true, displayName: true } }
          }
        }
      }
    });

    return {
      messages: messages.reverse(),
      hasMore: messages.length === Math.min(parseInt(limit), 100),
      nextCursor: messages.length > 0 ? messages[0].createdAt.toISOString() : null
    };
  });

  // --- Add Reaction ---
  fastify.post('/:messageId/reactions', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { messageId } = request.params;
    const { emoji } = request.body;
    const userId = request.user.id;

    if (!emoji) return reply.status(400).send({ error: 'Emoji required' });

    // Check message existence and access
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: { include: { members: true } } }
    });

    if (!message) return reply.status(404).send({ error: 'Message not found' });

    const isMember = message.conversation.members.some(m => m.userId === userId);
    if (!isMember) return reply.status(403).send({ error: 'Not a member' });

    // Create reaction (ignore duplicates)
    try {
      const reaction = await prisma.reaction.create({
        data: { messageId, userId, emoji },
        include: { user: { select: { handle: true, displayName: true } } }
      });

      // Broadcast
      fastify.io.to(message.conversationId).emit('reaction:add', {
        messageId,
        reaction
      });

      return reaction;
    } catch (e) {
      if (e.code === 'P2002') {
        // Already reacting with this emoji, just return existing
        return await prisma.reaction.findUnique({
          where: { messageId_userId_emoji: { messageId, userId, emoji } }
        });
      }
      throw e;
    }
  });

  // --- Remove Reaction ---
  fastify.delete('/:messageId/reactions', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { messageId } = request.params;
    const { emoji } = request.body;
    const userId = request.user.id;

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { conversationId: true }
    });

    if (!message) return reply.status(404).send({ error: 'Message not found' });

    try {
      await prisma.reaction.delete({
        where: { messageId_userId_emoji: { messageId, userId, emoji } }
      });

      fastify.io.to(message.conversationId).emit('reaction:remove', {
        messageId,
        userId,
        emoji
      });

      return { success: true };
    } catch (e) {
      if (e.code === 'P2025') return { success: true }; // Already deleted
      throw e;
    }
  });

  // --- Search messages globally ---
  fastify.get('/search/messages', { preHandler: [fastify.authenticate] }, async (request) => {
    const myId = request.user.id;
    const { q, limit = 30 } = request.query;

    if (!q || q.length < 2) return { results: [] };

    // Get user's conversation IDs
    const memberships = await prisma.member.findMany({
      where: { userId: myId },
      select: { conversationId: true }
    });
    const convIds = memberships.map(m => m.conversationId);

    // Search in those conversations (plaintext search — works for unencrypted messages)
    const results = await prisma.message.findMany({
      where: {
        conversationId: { in: convIds },
        body: { contains: q },
        deletedAt: null
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit), 50),
      include: {
        sender: { select: { id: true, handle: true, displayName: true } },
        conversation: { select: { id: true, type: true, title: true } }
      }
    });

    return { results };
  });
}
