FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies (only production packages)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source and database schema
COPY src ./src
COPY schema.sql ./

# Non-root user for security
USER node

EXPOSE 5000

ENV NODE_ENV=production \
    PORT=5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "src/server.js"]
