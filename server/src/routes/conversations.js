import { prisma } from '../server.js';

export default async function conversationRoutes(fastify) {

  // --- Create conversation ---
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { type = 'direct', title, memberIds = [] } = request.body || {};
    const myId = request.user.id;

    // For direct chats, check if one already exists between these two users
    if (type === 'direct' && memberIds.length === 1) {
      const otherId = memberIds[0];
      const existing = await prisma.conversation.findFirst({
        where: {
          type: 'direct',
          AND: [
            { members: { some: { userId: myId } } },
            { members: { some: { userId: otherId } } }
          ]
        },
        include: {
          members: { include: { user: { select: { id: true, handle: true, displayName: true } } } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 }
        }
      });
      if (existing) {
        return { conversation: formatConversation(existing, myId) };
      }
    }

    // Create new conversation
    const allMemberIds = [myId, ...memberIds.filter(id => id !== myId)];

    const conversation = await prisma.conversation.create({
      data: {
        type,
        title: type === 'group' ? (title || 'New Group') : null,
        members: {
          create: allMemberIds.map((userId, i) => ({
            userId,
            role: i === 0 ? 'owner' : 'member'
          }))
        }
      },
      include: {
        members: { include: { user: { select: { id: true, handle: true, displayName: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 }
      }
    });

    return { conversation: formatConversation(conversation, myId) };
  });

  // --- List my conversations ---
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const myId = request.user.id;

    const conversations = await prisma.conversation.findMany({
      where: { members: { some: { userId: myId } } },
      include: {
        members: { include: { user: { select: { id: true, handle: true, displayName: true } } } },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        _count: {
          select: { messages: { where: { deletedAt: null } } }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Calculate unread counts
    const conversationsWithUnread = await Promise.all(conversations.map(async (conv) => {
      const cursor = await prisma.readCursor.findUnique({
        where: { conversationId_userId: { conversationId: conv.id, userId: myId } }
      });
      
      const lastReadAt = cursor?.updatedAt || new Date(0); // If no cursor, assume very old (everything unread?) 
      // Actually, if no cursor, user might just have joined. Let's assume 0 for safety or maybe joinedAt.
      
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: conv.id,
          createdAt: { gt: lastReadAt },
          senderId: { not: myId },
          deletedAt: null
        }
      });
      
      return { ...conv, unreadCount };
    }));

    return {
      conversations: conversationsWithUnread.map(c => formatConversation(c, myId))
    };
  });

  // --- Get single conversation ---
  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const myId = request.user.id;
    const conv = await prisma.conversation.findFirst({
      where: {
        id: request.params.id,
        members: { some: { userId: myId } }
      },
      include: {
        members: { include: { user: { select: { id: true, handle: true, displayName: true } } } },
        messages: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 1 }
      }
    });

    if (!conv) return reply.status(404).send({ error: 'Conversation not found' });
    if (!conv) return reply.status(404).send({ error: 'Conversation not found' });
    
    // For single conversation, fetch unread count too (though usually 0 if just opened)
    const cursor = await prisma.readCursor.findUnique({
      where: { conversationId_userId: { conversationId: conv.id, userId: myId } }
    });
    const lastReadAt = cursor?.updatedAt || new Date(0);
    const unreadCount = await prisma.message.count({
      where: {
        conversationId: conv.id,
        createdAt: { gt: lastReadAt },
        senderId: { not: myId },
        deletedAt: null
      }
    });

    return { conversation: formatConversation({ ...conv, unreadCount }, myId) };
  });
}

function formatConversation(conv, myId) {
  const otherMembers = conv.members.filter(m => m.userId !== myId);
  return {
    id: conv.id,
    type: conv.type,
    title: conv.type === 'direct'
      ? (otherMembers.length > 0
          ? (otherMembers[0].user.displayName || otherMembers[0].user.handle)
          : 'Saved Messages')
      : conv.title,
    members: conv.members.map(m => ({
      id: m.user.id,
      handle: m.user.handle,
      displayName: m.user.displayName,
      role: m.role
    })),
    lastMessage: conv.messages?.[0] || null,
    messageCount: conv._count?.messages || 0,
    messageCount: conv._count?.messages || 0,
    unreadCount: conv.unreadCount || 0,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt
  };
}
