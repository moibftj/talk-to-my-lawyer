# Use the official Node.js 20 image as the base
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system dependencies (if needed)
RUN apk add --no-cache bash

# Copy package manager files and install dependencies
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Build the Next.js app (if needed)
RUN pnpm build || echo "No build step"

# Expose the default Next.js port
EXPOSE 3000

# Start the app
CMD ["pnpm", "start"]
