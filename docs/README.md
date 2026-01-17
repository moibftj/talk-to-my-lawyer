# Documentation Index

This document provides an overview of all documentation in the Talk-To-My-Lawyer repository.

---

## Main Documentation (Start Here)

These are the primary comprehensive guides that consolidate all essential information:

### 1. [Setup & Configuration Guide](SETUP_AND_CONFIGURATION.md)
**Purpose**: Complete setup and configuration for development and production  
**Topics**:
- Getting started and prerequisites
- Environment variables (complete reference)
- Database setup and migrations
- Admin user management (multi-admin system)
- Test mode configuration
- Security configuration

### 2. [Architecture & Development Guide](ARCHITECTURE_AND_DEVELOPMENT.md)
**Purpose**: System architecture and development guidelines  
**Topics**:
- System overview and non-negotiables
- Tech stack and architecture
- Domain model (types, entities, database functions)
- Core workflows (registration, letter generation, review, payments, referrals)
- Development guidelines and best practices
- Testing guidelines (manual testing approach)

### 3. [API & Integrations Guide](API_AND_INTEGRATIONS.md)
**Purpose**: Third-party API integrations and testing  
**Topics**:
- Stripe setup and payment processing
- Stripe webhook configuration
- Email service configuration (Resend, Brevo, SendGrid, SMTP)
- GitHub secrets and CI setup
- Testing payments with test cards

### 4. [Deployment Guide](DEPLOYMENT_GUIDE.md)
**Purpose**: Production deployment, CI/CD, and operations  
**Topics**:
- Production deployment checklist
- Vercel deployment (step-by-step)
- CI/CD pipeline (GitHub Actions)
- Production monitoring (KPIs, alerts, health checks)
- Production runbook (troubleshooting, common issues)

---

## Topic-Specific Documentation

These documents provide focused, deeper dives into individual areas.
They **complement** the main guides and are referenced from them.

### [ADMIN_GUIDE.md](ADMIN_GUIDE.md)
**Purpose**: Admin user management and multi-admin system  
**Topics**:
- Multi-admin system overview
- Admin role structure (Super Admin, Attorney Admin)
- Creating and managing admin users
- Permissions matrix
- Troubleshooting

### [SETUP.md](SETUP.md)
**Purpose**: Installation and configuration reference  
**Topics**:
- Prerequisites and dependencies
- Environment variable configuration
- GitHub Secrets setup

### [DEVELOPMENT.md](DEVELOPMENT.md)
**Purpose**: Development patterns and practices  
**Topics**:
- Architecture patterns
- API route structure
- Component conventions
- Best practices

### [DEPLOYMENT.md](DEPLOYMENT.md)
**Purpose**: CI/CD pipeline reference  
**Topics**:
- GitHub Actions workflows
- Environment configuration
- Monitoring setup

### [OPERATIONS.md](OPERATIONS.md)
**Purpose**: Production operations guide  
**Topics**:
- Common production issues
- Monitoring & alerts
- Incident response
- Maintenance tasks

### [PAYMENTS.md](PAYMENTS.md)
**Purpose**: Stripe integration reference  
**Topics**:
- Stripe environment setup
- Webhook configuration
- Test card numbers
- Payment flow testing

### [TESTING.md](TESTING.md)
**Purpose**: Testing procedures and practices  
**Topics**:
- Test mode configuration
- Manual testing procedures
- End-to-end test flows

### [DATABASE.md](DATABASE.md)
**Purpose**: Database operations reference  
**Topics**:
- Database schema
- Core tables and relationships
- Database functions (RPC)
- Migration execution

### [SECURITY.md](SECURITY.md)
**Purpose**: Security practices and audit results  
**Topics**:
- Security audit results
- Vulnerability fixes
- Best practices
- Incident response

### [CONSOLIDATION_SUMMARY.md](CONSOLIDATION_SUMMARY.md)
**Purpose**: Summary of documentation consolidation effort  
**Topics**:
- Before & after file structure
- Content mapping
- Migration guide

---

## Specialized Documentation

These documents cover specific technical or operational concerns:

### [TRACING.md](TRACING.md)
**Purpose**: OpenTelemetry distributed tracing setup and usage  
**Topics**:
- OpenTelemetry configuration
- Tracing AI operations, database queries, HTTP requests
- Local development with Jaeger
- Production observability platforms
- Performance optimization

### [CURRENT_APP_STATE.md](CURRENT_APP_STATE.md)
**Purpose**: Quick reference for current application state  
**Note**: One-line reference file

---

## Developer Tools

### `.github/copilot-instructions.md`
**Purpose**: Instructions for GitHub Copilot in this codebase  
**Note**: Used by AI coding assistants

### `skills/env-var-specialist/SKILL.md`
**Purpose**: Specialized skill for environment variable management  
**Note**: Custom validation and enforcement logic

---

## Quick Navigation

- **For New Developers** → [Setup & Configuration Guide](SETUP_AND_CONFIGURATION.md)
- **For Understanding the System** → [Architecture & Development Guide](ARCHITECTURE_AND_DEVELOPMENT.md)
- **For Deployment** → [Deployment Guide](DEPLOYMENT_GUIDE.md)
- **For Integrations** → [API & Integrations Guide](API_AND_INTEGRATIONS.md)
- **For Admin Management** → [Admin Guide](ADMIN_GUIDE.md)
- **For Production Operations** → [Operations Guide](OPERATIONS.md)
- **For Security** → [Security Guide](SECURITY.md)
- **For Troubleshooting** → [Deployment Guide](DEPLOYMENT_GUIDE.md) (Production Runbook)

---


## Documentation Maintenance Rules

1. **Main guides first** — update the 4 core documents
2. **Keep references accurate** — no broken links
3. **Test instructions** — commands must actually work
4. **Update this index** whenever files change
