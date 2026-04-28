# Use Node.js LTS (20) as base
FROM node:20-slim AS base

# Install openssl for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files for server
COPY server/package*.json ./server/
COPY server/prisma ./server/prisma/

# Install dependencies
RUN cd server && npm install

# Generate Prisma client
RUN cd server && npx prisma generate

# Copy the rest of the application
COPY server ./server/
COPY web ./web/

# Final environment
WORKDIR /app/server
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV JWT_SECRET=change-me-in-production-use-env-file

# Start the application
# Note: We run npx prisma db push on start to ensure DB is ready if dev.db doesn't exist
CMD ["sh", "-c", "npx prisma db push && node src/server.js"]
