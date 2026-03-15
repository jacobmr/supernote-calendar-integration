FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for TypeScript build)
RUN npm ci && npm cache clean --force

# Copy source code and config
COPY src ./src
COPY config ./config
COPY tsconfig.json ./
COPY start.sh ./

# Build TypeScript
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Create data directory for state persistence
RUN mkdir -p data

# Expose Express server port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=15s \
  CMD curl -f http://localhost:3000/health || exit 1

# Run both Express server and scheduler
CMD ["sh", "start.sh"]
