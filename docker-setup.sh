#!/bin/bash
# Docker Setup Guide - Talk-To-My-Lawyer
# This script helps you build and run the application in a Docker container

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Talk-To-My-Lawyer - Docker Setup Guide                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed${NC}"
    echo "Please install Docker from https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose is not installed${NC}"
    echo "Please install Docker Compose from https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✓ Docker and Docker Compose are installed${NC}"

# Check if .env.docker exists
if [ ! -f .env.docker ]; then
    echo -e "${YELLOW}⚠ .env.docker not found. Creating from template...${NC}"
    cp .env.docker .env.docker
    echo -e "${BLUE}📝 Please edit .env.docker with your configuration${NC}"
    echo -e "${BLUE}   Essential variables to update:${NC}"
    echo "   - NEXT_PUBLIC_SUPABASE_URL"
    echo "   - NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "   - SUPABASE_SERVICE_ROLE_KEY"
    echo "   - OPENAI_API_KEY"
    echo "   - STRIPE_SECRET_KEY & NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
    echo "   - RESEND_API_KEY"
fi

# Menu
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo "What would you like to do?"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo "1. Build and start all services (first time setup)"
echo "2. Start services (if already built)"
echo "3. Stop all services"
echo "4. View logs"
echo "5. Enter container shell"
echo "6. Run database migrations"
echo "7. Clean up (remove containers and volumes)"
echo "8. Show database connection info"
echo "9. Exit"
echo ""

read -p "Enter your choice (1-9): " choice

case $choice in
    1)
        echo -e "${BLUE}🔨 Building Docker image and starting services...${NC}"
        docker-compose --env-file .env.docker -f docker-compose.yml up --build -d
        echo -e "${GREEN}✓ Services started!${NC}"
        echo ""
        echo -e "${BLUE}📍 Service URLs:${NC}"
        echo "   - Application: http://localhost:3000"
        echo "   - pgAdmin: http://localhost:5050"
        echo ""
        echo "Waiting for services to be healthy..."
        sleep 10
        echo -e "${GREEN}✓ Setup complete!${NC}"
        echo ""
        echo -e "${BLUE}Next steps:${NC}"
        echo "1. Update .env.docker with your API keys"
        echo "2. Run: docker-compose --env-file .env.docker exec app pnpm db:migrate"
        echo "3. Visit http://localhost:3000"
        ;;
    2)
        echo -e "${BLUE}▶️  Starting services...${NC}"
        docker-compose --env-file .env.docker -f docker-compose.yml up -d
        echo -e "${GREEN}✓ Services started!${NC}"
        ;;
    3)
        echo -e "${BLUE}⏹ Stopping services...${NC}"
        docker-compose --env-file .env.docker -f docker-compose.yml down
        echo -e "${GREEN}✓ Services stopped${NC}"
        ;;
    4)
        echo -e "${BLUE}📋 Showing logs (Ctrl+C to exit)...${NC}"
        docker-compose --env-file .env.docker -f docker-compose.yml logs -f
        ;;
    5)
        echo -e "${BLUE}🐚 Entering container shell...${NC}"
        docker-compose --env-file .env.docker -f docker-compose.yml exec app bash
        ;;
    6)
        echo -e "${BLUE}🔄 Running database migrations...${NC}"
        docker-compose --env-file .env.docker -f docker-compose.yml exec app pnpm db:migrate
        echo -e "${GREEN}✓ Migrations completed${NC}"
        ;;
    7)
        echo -e "${RED}⚠️  This will remove containers and volumes!${NC}"
        read -p "Are you sure? (y/N): " confirm
        if [ "$confirm" = "y" ]; then
            docker-compose --env-file .env.docker -f docker-compose.yml down -v
            echo -e "${GREEN}✓ Cleanup complete${NC}"
        fi
        ;;
    8)
        echo ""
        echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
        echo "Database Connection Information"
        echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
        echo ""
        echo "From Host Machine:"
        echo "  Host: localhost"
        echo "  Port: 5432"
        echo "  User: postgres"
        echo "  Password: postgres"
        echo "  Database: ttml_dev"
        echo "  Connection String: postgresql://postgres:postgres@localhost:5432/ttml_dev"
        echo ""
        echo "From Container:"
        echo "  Host: postgres"
        echo "  Port: 5432"
        echo "  User: postgres"
        echo "  Password: postgres"
        echo "  Database: ttml_dev"
        echo "  Connection String: postgresql://postgres:postgres@postgres:5432/ttml_dev"
        echo ""
        echo "pgAdmin Web Interface:"
        echo "  URL: http://localhost:5050"
        echo "  Email: admin@localhost"
        echo "  Password: admin"
        echo ""
        echo -e "${BLUE}PostgreSQL CLI commands inside container:${NC}"
        echo "  docker-compose exec postgres psql -U postgres -d ttml_dev"
        echo ""
        echo -e "${BLUE}Useful psql commands:${NC}"
        echo "  \\dt            - List all tables"
        echo "  \\d table_name  - Describe a table"
        echo "  \\l             - List all databases"
        echo "  \\q             - Exit psql"
        echo ""
        ;;
    9)
        echo "Goodbye!"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac
