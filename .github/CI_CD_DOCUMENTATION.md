# CI/CD Pipeline Documentation

This document provides an overview of the automated CI/CD pipeline configuration for the Talk-To-My-Lawyer application.

## Overview

The CI/CD pipeline is implemented using GitHub Actions and consists of three main workflow files:

1. **`ci-cd.yml`** - Main CI/CD pipeline with build, test, and deployment
2. **`auto-pr.yml`** - Automated pull request creation for maintenance tasks
3. **`dependabot.yml`** - Automated dependency updates

## Main CI/CD Pipeline (`ci-cd.yml`)

### Triggers
- Runs on all pushes to any branch
- Runs on pull requests to `main` branch

### Jobs

#### 1. Lint & Type Check
- Runs ESLint to check code quality
- Performs TypeScript type checking
- Continues on error to allow other jobs to complete

#### 2. Build Application
- Builds the Next.js application
- Uses minimal placeholder environment variables for CI
- Uploads build artifacts for verification
- Depends on successful lint/type check

#### 3. Security Audit
- Runs `pnpm audit` to check for known vulnerabilities
- Checks for outdated dependencies
- Continues on error to allow other jobs to complete

#### 4. Auto-fix & Commit
- Automatically fixes linting issues
- Commits and pushes fixes back to the branch
- **Only runs on push events to non-main branches**
- Skips CI on auto-commits using `[skip ci]` tag

#### 5. Deploy to Vercel
- Deploys the application to Vercel production
- **Only runs on pushes to `main` branch**
- Requires `VERCEL_TOKEN` secret to be configured
- Posts deployment status as a commit comment
- Depends on successful build and security audit

### Required Secrets

Add these secrets to your GitHub repository settings (Settings → Secrets and variables → Actions):

- `VERCEL_TOKEN` - Vercel deployment token
  - Get from: https://vercel.com/account/tokens
  - Scope: Full access to your team/account

### Permissions

The workflow has the following permissions:
- `contents: write` - For pushing commits
- `pull-requests: write` - For creating/updating PRs
- `issues: write` - For creating/updating issues
- `checks: write` - For creating check runs

## Automated PR Creation (`auto-pr.yml`)

### Purpose
Creates pull requests for automated maintenance tasks.

### Triggers
- Manual dispatch via GitHub UI
- Can be scheduled (currently disabled)

### Features
- Auto-fixes linting issues
- Updates lock files
- Creates a PR with all changes
- Labels PR as `automated` and `maintenance`

### Usage

1. Go to Actions tab in GitHub
2. Select "Auto Create PR" workflow
3. Click "Run workflow"
4. Fill in optional parameters (title, branch name, description)
5. Click "Run workflow"

## Dependabot Configuration (`dependabot.yml`)

### Package Ecosystems Monitored

#### 1. npm/pnpm Dependencies
- **Schedule**: Weekly on Mondays at 09:00 UTC
- **Target Branch**: main
- **Max Open PRs**: 10

#### 2. GitHub Actions
- **Schedule**: Weekly on Mondays at 09:00 UTC
- **Target Branch**: main
- **Max Open PRs**: 5

### Dependency Grouping

Dependencies are grouped to reduce PR noise:

- **radix-ui** - All Radix UI components (minor/patch)
- **dev-dependencies** - All dev dependencies (minor/patch)
- **react** - React and React-related packages (minor/patch)
- **nextjs** - Next.js packages (patch only)
- **typescript** - TypeScript and type definitions (minor/patch)
- **stripe** - Stripe packages (minor/patch)
- **supabase** - Supabase packages (minor/patch)
- **tailwind** - TailwindCSS packages (minor/patch)
- **github-actions** - All GitHub Actions (minor/patch)

### Ignored Updates

Major version updates are ignored for:
- `next` - Breaking changes require manual review
- `react` and `react-dom` - Breaking changes require manual review

### Labels

All Dependabot PRs are labeled with:
- `dependencies`
- `automated`

GitHub Actions PRs also get:
- `github-actions`

## Setup Instructions

### 1. Configure GitHub Secrets

Add the following secrets to your repository:

```
VERCEL_TOKEN - Your Vercel deployment token
```

Optionally, for enhanced security:
```
GITHUB_TOKEN - Automatically provided by GitHub Actions
```

### 2. Configure Vercel Project

1. Link your repository to Vercel
2. Configure production branch as `main`
3. Set up environment variables in Vercel dashboard
4. Generate a deployment token

### 3. Enable Dependabot

Dependabot is automatically enabled when the `dependabot.yml` file is present in `.github/` directory.

### 4. Customize Reviewers (Optional)

Edit `.github/dependabot.yml` and uncomment/update:

```yaml
reviewers:
  - "your-github-username"
assignees:
  - "your-github-username"
```

## Workflow Behavior

### On Feature Branch Push
1. Lint & Type Check runs
2. Build runs (if lint passes)
3. Security Audit runs
4. Auto-fix runs and commits fixes (if any)

### On Pull Request to Main
1. Lint & Type Check runs
2. Build runs (if lint passes)
3. Security Audit runs
4. Auto-fix does NOT run (to avoid permission issues)

### On Push to Main
1. Lint & Type Check runs
2. Build runs (if lint passes)
3. Security Audit runs
4. Deploy to Vercel runs (if all pass)
5. Deployment status posted as commit comment

### Weekly (via Dependabot)
1. Dependency updates checked
2. PRs created for updates
3. Grouped by package ecosystem
4. Labeled appropriately

## Troubleshooting

### Build Fails with Environment Variables
- The CI build uses placeholder values for environment variables
- Ensure `NEXT_PUBLIC_*` variables are handled gracefully in code
- Add any required build-time variables to the "Setup build environment" step

### Deployment Fails
- Verify `VERCEL_TOKEN` is set correctly
- Check Vercel project is linked to repository
- Ensure Vercel project settings match repository

### Auto-fix Commits Not Pushing
- Verify `GITHUB_TOKEN` has write permissions
- Check branch protection rules
- Ensure auto-fix job condition matches your branch

### Dependabot PRs Not Created
- Verify `dependabot.yml` syntax is correct
- Check Dependabot logs in Insights → Dependency graph → Dependabot
- Ensure dependencies in package.json can be updated

## Best Practices

1. **Always review Dependabot PRs** - Even automated updates should be reviewed
2. **Test deployments** - Monitor the first few automated deployments
3. **Keep secrets secure** - Never log or expose secret values
4. **Use branch protection** - Require status checks before merging
5. **Monitor workflow runs** - Check Actions tab regularly for failures

## Maintenance

### Updating Node.js Version
Edit the `NODE_VERSION` environment variable in `ci-cd.yml`:

```yaml
env:
  NODE_VERSION: '20'  # Update this
  PNPM_VERSION: '10.25.0'
```

### Updating pnpm Version
Edit the `PNPM_VERSION` environment variable in `ci-cd.yml`:

```yaml
env:
  NODE_VERSION: '20'
  PNPM_VERSION: '10.25.0'  # Update this
```

### Adding New Jobs
1. Add job definition in `ci-cd.yml`
2. Set appropriate `needs` dependency
3. Add required permissions if needed
4. Test on feature branch first

### Modifying Dependabot Groups
Edit `.github/dependabot.yml` and update the `groups` section under npm ecosystem.

## Status Badges

Add these to your README.md to show CI/CD status:

```markdown
![CI/CD Pipeline](https://github.com/[your-username]/[your-repo]/actions/workflows/ci-cd.yml/badge.svg)
```

## Support

For issues with:
- **GitHub Actions**: Check the Actions tab for detailed logs
- **Vercel Deployment**: Check Vercel dashboard and deployment logs
- **Dependabot**: Check Insights → Dependency graph → Dependabot

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [pnpm Documentation](https://pnpm.io/)
