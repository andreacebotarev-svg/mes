import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

import authRoutes from './routes/auth.js';
import conversationRoutes from './routes/conversations.js';
import messageRoutes from './routes/messages.js';
import keyRoutes from './routes/keys.js';
import uploadRoutes from './routes/upload.js';
import { setupSocketHandlers } from './sockets/handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const prisma = new PrismaClient();

const fastify = Fastify({ logger: true });

// --- Plugins ---
await fastify.register(cors, { origin: true });
await fastify.register(jwt, { secret: process.env.JWT_SECRET || 'dev-secret-change-in-production' });
await fastify.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

// Serve web client static files
const webClientPath = path.resolve(__dirname, '../../web');
await fastify.register(fastifyStatic, { root: webClientPath, prefix: '/' });

// Serve uploaded files
const uploadsPath = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
await fastify.register(fastifyStatic, {
  root: uploadsPath,
  prefix: '/uploads/',
  decorateReply: false
});

// --- Auth decorator ---
fastify.decorate('authenticate', async function (request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
});

// --- Routes ---
await fastify.register(authRoutes, { prefix: '/api' });
await fastify.register(conversationRoutes, { prefix: '/api/conversations' });
await fastify.register(messageRoutes, { prefix: '/api/conversations' });
await fastify.register(keyRoutes, { prefix: '/api/keys' });
await fastify.register(uploadRoutes, { prefix: '/api' });

// --- Start ---
const PORT = process.env.PORT || 3000;

try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });

  // --- Socket.io ---
  const io = new Server(fastify.server, {
    cors: { origin: '*' },
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 }
  });

  setupSocketHandlers(io, fastify);

  console.log(`\n🔐 CryptMessenger server running on http://localhost:${PORT}\n`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
