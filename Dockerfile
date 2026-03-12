FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Create data directory for state persistence
RUN mkdir -p data

# Expose port (not used by scheduler, but good practice)
EXPOSE 3000

# Run scheduler
CMD ["node", "dist/index-scheduler.js"]
