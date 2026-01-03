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

These documents cover individual topics in focused detail (from first consolidation approach):

### [ADMIN_GUIDE.md](ADMIN_GUIDE.md)
**Purpose**: Admin user management and multi-admin system
**Topics**:
- Multi-admin system overview
- Admin role structure (System Admin, Attorney Admin)
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

These documents cover specific technical topics:

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

## Reports & Test Plans

Historical reports and testing documentation:

### [final_verification_report.md](final_verification_report.md)
**Purpose**: Final verification report for Supabase project alignment
**Contents**:
- Letter allowance tests results
- Admin role separation verification
- Employee discount & commission data model
- Analytics functions verification

### [letter_allowance_test_plan.md](letter_allowance_test_plan.md)
**Purpose**: Test plan for letter allowance and credit functions
**Contents**:
- Test scenarios for allowance checks and deductions
- Setup scripts and execution procedures
- Expected results and verification

### [supabase_review_report.md](supabase_review_report.md)
**Purpose**: Supabase project and repository review
**Contents**:
- Data model discrepancies analysis
- Migration conflicts and recommendations
- Schema alignment issues

---

## Developer Tools

### .github/copilot-instructions.md
**Purpose**: Instructions for GitHub Copilot when working with this codebase
**Note**: Special file for AI coding assistant

### skills/env-var-specialist/SKILL.md
**Purpose**: Specialized skill for environment variable management
**Note**: Custom skill definition for environment variable validation

---

## Quick Navigation

**For New Developers**: Start with → [Setup & Configuration Guide](SETUP_AND_CONFIGURATION.md) or [Setup Guide](SETUP.md)

**For Understanding the System**: → [Architecture & Development Guide](ARCHITECTURE_AND_DEVELOPMENT.md) or [Development Guide](DEVELOPMENT.md)

**For Deployment**: → [Deployment Guide](DEPLOYMENT_GUIDE.md) or [Deployment Reference](DEPLOYMENT.md)

**For Integrations**: → [API & Integrations Guide](API_AND_INTEGRATIONS.md) or [Payments Guide](PAYMENTS.md)

**For Admin Management**: → [Admin Guide](ADMIN_GUIDE.md)

**For Production Operations**: → [Operations Guide](OPERATIONS.md)

**For Security**: → [Security Guide](SECURITY.md)

**For Troubleshooting**: → [Deployment Guide](DEPLOYMENT_GUIDE.md) (Production Runbook section)

---

## Removed/Consolidated Files

The following files were consolidated into the main guides above:

**Consolidated into Setup & Configuration:**
- ADMIN_SETUP.md
- TEST_MODE_GUIDE.md

**Consolidated into Architecture & Development:**
- ARCHITECTURE_PLAN.md
- AGENTS.md
- CLAUDE.md

**Consolidated into API & Integrations:**
- GITHUB_SECRETS_SETUP.md
- STRIPE_SETUP.md
- TEST_PAYMENTS.md
- docs/CI_SETUP.md

**Consolidated into Deployment Guide:**
- PRODUCTION_LAUNCH_COMPLETE.md
- VERCEL_DEPLOYMENT.md
- PRODUCTION_DEPLOYMENT_CHECKLIST.md
- PRODUCTION_MONITORING.md
- PRODUCTION_RUNBOOK.md
- CI_CD_DOCUMENTATION.md
- IMPLEMENTATION_SUMMARY.md
- QUICK_REFERENCE.md

**Obsolete/Redundant:**
- REVIEW.md - Review overview (content integrated)
- SECURITY_AUDIT_FIX.md - Security fixes (completed)

---

## Documentation Maintenance

When updating documentation:

1. **Main guides first**: Update the 4 main comprehensive guides
2. **Keep synchronized**: Ensure cross-references are accurate
3. **Test instructions**: Verify commands and procedures work
4. **Update index**: Keep this index file current

For questions or issues with documentation, refer to the relevant main guide or create an issue.
