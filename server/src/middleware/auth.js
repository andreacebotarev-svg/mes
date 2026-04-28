export async function authenticateRequest(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
}

export function authenticateSocket(fastify) {
  return (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = fastify.jwt.verify(token);
      socket.userId = decoded.id;
      socket.userHandle = decoded.handle;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  };
}
