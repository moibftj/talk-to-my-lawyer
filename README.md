# Talk-To-My-Lawyer 🚀

**Status**: ✅ **LIVE PRODUCTION** - Real payment processing active

AI-powered legal letter generation platform with mandatory attorney review.

🌐 **Live Site**: https://www.talk-to-my-lawyer.com  
⚖️ **Admin Portal**: https://www.talk-to-my-lawyer.com/secure-admin-gateway  
📊 **System Status**: https://www.talk-to-my-lawyer.com/api/health  

---

## 🎯 Production Features (LIVE)

- ✅ **Real Payment Processing** - Stripe Live Mode with actual transactions
- ✅ **AI Letter Generation** - OpenAI GPT-4 Turbo integration
- ✅ **Attorney Review Workflow** - Multi-admin letter approval system
- ✅ **Subscription Management** - Monthly/Yearly plans with credit system
- ✅ **Employee Referrals** - 5% commission system with payout requests
- ✅ **Production Email System** - Professional templates via Resend
- ✅ **Security & Rate Limiting** - Upstash Redis protection
- ✅ **Admin Analytics** - Revenue, user, and performance dashboards

---

## 💳 Payment Plans (Live Production)

- **Single Letter**: $299 (1 letter, one-time payment)
- **Monthly Plan**: $299/month (4 letters per month)
- **Yearly Plan**: $599/year (52 letters per year)
- **Free Trial**: First letter free for new users

---

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

---

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm
- Supabase account
- Stripe account
- OpenAI API key

### Installation

```bash
# Clone the repository
git clone https://github.com/moizjmj-pk/talk-to-my-lawyer.git
cd talk-to-my-lawyer

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env.local

# Fill in your environment variables
# See docs/SETUP_AND_CONFIGURATION.md for details

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
