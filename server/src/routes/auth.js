import bcrypt from 'bcryptjs';
import { prisma } from '../server.js';

// Pre-hashed invite code for "кампус"
// Generated with: bcrypt.hashSync("кампус", 10)
const INVITE_CODE_HASH = bcrypt.hashSync("кампус", 10);

export default async function authRoutes(fastify) {

  // --- Register ---
  fastify.post('/register', async (request, reply) => {
    const { handle, password, displayName, inviteCode } = request.body || {};

    if (!handle || !password) {
      return reply.status(400).send({ error: 'handle and password are required' });
    }
    if (!inviteCode) {
      return reply.status(400).send({ error: 'Invite code is required' });
    }

    // Validate invite code
    const codeValid = await bcrypt.compare(inviteCode, INVITE_CODE_HASH);
    if (!codeValid) {
      return reply.status(403).send({ error: 'Invalid invite code' });
    }

    if (handle.length < 3 || handle.length > 30) {
      return reply.status(400).send({ error: 'handle must be 3-30 characters' });
    }
    if (password.length < 6) {
      return reply.status(400).send({ error: 'password must be at least 6 characters' });
    }

    const existing = await prisma.user.findUnique({ where: { handle } });
    if (existing) {
      return reply.status(409).send({ error: 'Handle already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        handle,
        displayName: displayName || handle,
        passwordHash
      }
    });

    const token = fastify.jwt.sign({ id: user.id, handle: user.handle });

    return {
      user: { id: user.id, handle: user.handle, displayName: user.displayName },
      token
    };
  });

  // --- Login ---
  fastify.post('/login', async (request, reply) => {
    const { handle, password } = request.body || {};

    if (!handle || !password) {
      return reply.status(400).send({ error: 'handle and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { handle } });
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const token = fastify.jwt.sign({ id: user.id, handle: user.handle });

    return {
      user: { id: user.id, handle: user.handle, displayName: user.displayName },
      token
    };
  });

  // --- Me (get current user profile) ---
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: { id: true, handle: true, displayName: true, bio: true, avatarUrl: true, createdAt: true }
    });
    return { user };
  });

  // --- Update Profile ---
  fastify.post('/me', { preHandler: [fastify.authenticate] }, async (request) => {
    const { displayName, bio } = request.body || {};

    if (displayName && displayName.length > 50) {
      throw new Error('Display name too long');
    }
    if (bio && bio.length > 200) {
      throw new Error('Bio too long');
    }

    const user = await prisma.user.update({
      where: { id: request.user.id },
      data: {
        displayName: displayName !== undefined ? displayName : undefined,
        bio: bio !== undefined ? bio : undefined
      },
      select: { id: true, handle: true, displayName: true, bio: true, avatarUrl: true }
    });
    return { user };
  });

  // --- Get ALL registered users (for sidebar) ---
  fastify.get('/users', { preHandler: [fastify.authenticate] }, async (request) => {
    const users = await prisma.user.findMany({
      where: { id: { not: request.user.id } },
      select: { id: true, handle: true, displayName: true },
      orderBy: { displayName: 'asc' }
    });
    return { users };
  });

  // --- Search users (to start conversations) ---
  fastify.get('/users/search', { preHandler: [fastify.authenticate] }, async (request) => {
    const { q } = request.query;
    if (!q || q.length < 2) return { users: [] };

    const users = await prisma.user.findMany({
      where: {
        handle: { contains: q },
        id: { not: request.user.id }
      },
      select: { id: true, handle: true, displayName: true },
      take: 20
    });
    return { users };
  });
}
