# Talk-To-My-Lawyer 🚀

**Status**: ✅ **LIVE PRODUCTION** - Real payment processing active

AI-powered legal letter generation platform with mandatory attorney review.

🌐 **Live Site**: https://www.talk-to-my-lawyer.com  
⚖️ **Admin Portal**: https://www.talk-to-my-lawyer.com/secure-admin-gateway  
📊 **System Status**: https://www.talk-to-my-lawyer.com/api/health

## 🎯 Production Features (LIVE)

- ✅ **Real Payment Processing** - Stripe Live Mode with actual transactions
- ✅ **AI Letter Generation** - OpenAI GPT-4 Turbo integration
- ✅ **Attorney Review Workflow** - Multi-admin letter approval system
- ✅ **Subscription Management** - Monthly/Yearly plans with credit system
- ✅ **Employee Referrals** - 5% commission system with payout requests
- ✅ **Production Email System** - Professional templates via Resend
- ✅ **Security & Rate Limiting** - Upstash Redis protection
- ✅ **Admin Analytics** - Revenue, user, and performance dashboards

## 💳 Payment Plans (Live Production)

- **Single Letter**: $299 (1 letter, one-time payment)
- **Monthly Plan**: $299/month (4 letters per month) 
- **Yearly Plan**: $599/year (52 letters per year)
- **Free Trial**: First letter free for new users

## 📚 Documentation

Complete documentation is available in the `/docs` directory. See **[docs/README.md](./docs/README.md)** for a comprehensive documentation index.

### Comprehensive Guides (Recommended Starting Point)

- **[Setup & Configuration Guide](docs/SETUP_AND_CONFIGURATION.md)** - Environment setup, database, admin users, test mode
- **[Architecture & Development Guide](docs/ARCHITECTURE_AND_DEVELOPMENT.md)** - System architecture, workflows, development guidelines
- **[API & Integrations Guide](docs/API_AND_INTEGRATIONS.md)** - Stripe, email, GitHub secrets, payment testing
- **[Deployment Guide](docs/DEPLOYMENT_GUIDE.md)** - Production deployment, CI/CD, monitoring, runbooks

### Topic-Specific Guides

| Guide | Description |
|-------|-------------|
| [**Setup Guide**](./docs/SETUP.md) | Complete installation and configuration |
| [**Admin Guide**](./docs/ADMIN_GUIDE.md) | Admin user management and multi-admin system |
| [**Development**](./docs/DEVELOPMENT.md) | Architecture, patterns, and development guide |
| [**Deployment**](./docs/DEPLOYMENT.md) | CI/CD pipeline and Vercel deployment |
| [**Operations**](./docs/OPERATIONS.md) | Production operations and monitoring |
| [**Payments**](./docs/PAYMENTS.md) | Stripe integration and payment testing |
| [**Testing**](./docs/TESTING.md) | Test mode, manual testing, and tracing |
| [**Database**](./docs/DATABASE.md) | Database schema, migrations, and operations |
| [**Security**](./docs/SECURITY.md) | Security audit, fixes, and best practices |
| [**Tracing**](./docs/TRACING.md) | OpenTelemetry distributed tracing setup |

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm
- Supabase account
- Stripe account
- OpenAI API key

### Installation

```bash
# Clone repository
git clone https://github.com/moizjmj-pk/talk-to-my-lawyer.git
cd talk-to-my-lawyer

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env.local

# Configure environment variables (see docs/SETUP_AND_CONFIGURATION.md or docs/SETUP.md)
# Edit .env.local with your credentials

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

Visit `http://localhost:3000` to see the application.

### Environment Variables (Quick Reference)

Copy `.env.example` to `.env.local` and fill in:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI
OPENAI_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Admin Portal
ADMIN_PORTAL_KEY=

# Email Service
EMAIL_PROVIDER=resend
RESEND_API_KEY=

# Rate Limiting
KV_REST_API_URL=
KV_REST_API_TOKEN=
```

See **[docs/SETUP_AND_CONFIGURATION.md](./docs/SETUP_AND_CONFIGURATION.md)** or **[docs/SETUP.md](./docs/SETUP.md)** for complete environment variable documentation.

## Essential Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start development server
pnpm build            # Production build
pnpm lint             # Lint code
pnpm validate-env     # Validate environment variables
pnpm db:migrate       # Run database migrations
```

## Creating Admin Users

```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/create-additional-admin.ts <email> <password>
```

See **[docs/ADMIN_GUIDE.md](./docs/ADMIN_GUIDE.md)** for complete admin management documentation.

## Deployment

The project uses GitHub Actions for CI/CD and deploys to Vercel:

- **Push to `main`** triggers automatic production deployment
- **Pull requests** trigger preview deployments
- **Dependabot** handles dependency updates weekly

See **[docs/DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md)** or **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)** for complete deployment documentation.

## Support

- **Documentation**: See [/docs](./docs) directory
- **Issues**: https://github.com/moizjmj-pk/talk-to-my-lawyer/issues
- **Production Site**: https://www.talk-to-my-lawyer.com

## License

Private - All rights reserved
