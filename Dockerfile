# Multi-stage build for Talk-To-My-Lawyer application
# Stage 1: Builder & Development Environment
FROM node:20-alpine AS builder

# Install system dependencies for development, database tools, and CLI tools
RUN apk add --no-cache \
    bash \
    git \
    curl \
    wget \
    ca-certificates \
    openssh-client \
    postgresql-client \
    postgresql \
    jq \
    openssl \
    tar \
    gzip \
    zip \
    unzip \
    make \
    python3 \
    py3-pip \
    build-base \
    libffi-dev \
    openssl-dev

# Install Supabase CLI
RUN npm install -g supabase@latest

# Install Vercel CLI
RUN npm install -g vercel@latest

# Install pnpm
RUN npm install -g pnpm@latest

# Set up working directory
WORKDIR /app

# Clone the repository (for container usage, this would be overridden with volume mount)
# Or copy from context if building with local code
COPY package.json pnpm-lock.yaml ./

# Install application dependencies
RUN pnpm install --frozen-lockfile

# Copy application code
COPY . .

# Build Next.js application
RUN pnpm build

# Stage 2: Production Runtime
FROM node:20-alpine AS production

# Install production runtime dependencies
RUN apk add --no-cache \
    bash \
    git \
    curl \
    ca-certificates \
    postgresql-client \
    jq \
    openssl

# Install CLI tools for production environment
RUN npm install -g pnpm@latest supabase@latest vercel@latest

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/app ./app

# Create entrypoint script
RUN cat > /entrypoint.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Starting Talk-To-My-Lawyer Container"

# Wait for database to be ready if DATABASE_URL is set
if [ ! -z "$DATABASE_URL" ]; then
    echo "⏳ Waiting for PostgreSQL to be ready..."
    until pg_isready -U ${DB_USER:-postgres} -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432}; do
        echo "PostgreSQL not ready, waiting..."
        sleep 2
    done
    echo "✅ PostgreSQL is ready"
fi

# Run database migrations if migration script exists
if [ -f "scripts/run-migrations.js" ] && [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "🔄 Running database migrations..."
    pnpm db:migrate || echo "⚠️ Migrations skipped or failed"
fi

# Health check
if [ -f "scripts/health-check.js" ] && [ "$RUN_HEALTH_CHECK" = "true" ]; then
    echo "🔍 Running health check..."
    node scripts/health-check.js
fi

# Start application
echo "▶️  Starting application..."
exec "$@"
EOF

chmod +x /entrypoint.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Expose ports
EXPOSE 3000 5432

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]

# Default command
CMD ["pnpm", "start"]
