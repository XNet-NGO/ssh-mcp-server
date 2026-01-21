# SSH MCP Server - Docker Image
# 
# This Dockerfile creates a containerized version of the SSH MCP Server
# for easy deployment and distribution.

FROM node:18-alpine

# Install OpenSSH client tools
RUN apk add --no-cache openssh-client

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --production

# Copy built application
COPY dist/ ./dist/

# Create .ssh directory for SSH configuration
RUN mkdir -p /root/.ssh && chmod 700 /root/.ssh

# Set environment
ENV NODE_ENV=production

# Expose no ports (uses stdio)
# The server communicates via stdin/stdout

# Health check (optional - checks if node process is running)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD pgrep -f "node.*server.js" || exit 1

# Run the server
CMD ["node", "dist/server.js"]

# Labels
LABEL maintainer="SSH MCP Server Team"
LABEL version="0.1.0"
LABEL description="Model Context Protocol server for SSH operations"
