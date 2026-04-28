import { prisma } from '../server.js';

export default async function keyRoutes(fastify) {

  // --- Upload key bundle ---
  fastify.post('/upload', { preHandler: [fastify.authenticate] }, async (request) => {
    const { identityKey, signedPreKey, signedPreKeySig, oneTimeKeys } = request.body;

    await prisma.keyBundle.upsert({
      where: { userId: request.user.id },
      update: {
        identityKey,
        signedPreKey,
        signedPreKeySig,
        oneTimeKeys: JSON.stringify(oneTimeKeys || [])
      },
      create: {
        userId: request.user.id,
        identityKey,
        signedPreKey,
        signedPreKeySig,
        oneTimeKeys: JSON.stringify(oneTimeKeys || [])
      }
    });

    return { status: 'ok' };
  });

  // --- Fetch key bundle for a user ---
  fastify.get('/:userId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const bundle = await prisma.keyBundle.findUnique({
      where: { userId: request.params.userId }
    });

    if (!bundle) {
      return reply.status(404).send({ error: 'No key bundle found for this user' });
    }

    // Pop one one-time key (consume it)
    let oneTimeKeys = [];
    try { oneTimeKeys = JSON.parse(bundle.oneTimeKeys); } catch {}
    const oneTimeKey = oneTimeKeys.shift() || null;

    // Update remaining keys
    await prisma.keyBundle.update({
      where: { userId: request.params.userId },
      data: { oneTimeKeys: JSON.stringify(oneTimeKeys) }
    });

    return {
      userId: bundle.userId,
      identityKey: bundle.identityKey,
      signedPreKey: bundle.signedPreKey,
      signedPreKeySig: bundle.signedPreKeySig,
      oneTimeKey
    };
  });
}
