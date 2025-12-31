# CI/CD Quick Reference

## 🚀 Quick Start

### First Time Setup
1. **Add Vercel Token Secret**
   ```
   Settings → Secrets → Actions → New secret
   Name: VERCEL_TOKEN
   Value: [Your Vercel token from https://vercel.com/account/tokens]
   ```

2. **Merge This PR**
   - Workflows activate automatically after merge

3. **Monitor First Deployment**
   - Push to `main` triggers automatic deployment
   - Check Actions tab for status

## 📋 Workflows Overview

### Main CI/CD Pipeline (`ci-cd.yml`)
**Runs on:** Push to any branch, PR to main

| Job | When | Purpose |
|-----|------|---------|
| Lint & Type Check | Always | Code quality validation |
| Build | After lint | Next.js build verification |
| Security Audit | Parallel | Dependency vulnerability check |
| Auto-fix | Non-main branches | Auto-fix and commit linting issues |
| Deploy | Main branch only | Deploy to Vercel production |

### Auto PR Workflow (`auto-pr.yml`)
**Runs on:** Manual trigger

- Go to Actions → Auto Create PR → Run workflow
- Fixes linting and creates a PR
- Useful for bulk maintenance

### Dependabot (`dependabot.yml`)
**Runs on:** Weekly (Mondays 09:00 UTC)

- Automatically creates PRs for dependency updates
- Groups related dependencies
- Review and merge as needed

## 🎯 Common Tasks

### Deploy to Production
```bash
git push origin main
# Automatic deployment triggered
# Check Actions tab for status
```

### Trigger Auto-fix Manually
```bash
# Go to GitHub Actions → Auto Create PR → Run workflow
# Or use the workflow_dispatch API
```

### Check Deployment Status
1. Go to Actions tab
2. Click on latest workflow run
3. Check "Deploy to Vercel" job
4. See deployment URL in job output

### Review Dependency Updates
1. Dependabot creates PRs weekly
2. Review changes in PR
3. CI runs automatically
4. Merge when ready

## 🔧 Troubleshooting

### Build Fails
- Check environment variables in workflow
- Verify placeholder values are sufficient for build
- Review build logs in Actions tab

### Deployment Fails
- Verify `VERCEL_TOKEN` is set correctly
- Check Vercel project is linked to repo
- Review Vercel deployment logs

### Auto-fix Not Committing
- Verify GITHUB_TOKEN has write permissions
- Check branch protection rules
- Ensure branch is not `main`

### Dependabot PRs Not Created
- Check Dependabot logs: Insights → Dependency graph → Dependabot
- Verify `dependabot.yml` syntax
- Ensure dependencies can be updated

## 📊 Status Badges

Add to README.md:
```markdown
![CI/CD](https://github.com/[your-username]/[your-repo]/actions/workflows/ci-cd.yml/badge.svg)
```

## 🔐 Secrets Required

| Secret | Required For | Where to Get |
|--------|-------------|--------------|
| VERCEL_TOKEN | Deployment | https://vercel.com/account/tokens |
| GITHUB_TOKEN | Auto-commits, PRs | Automatically provided by GitHub |

## 📝 Branch Strategy

- **Feature branches**: Full CI + Auto-fix
- **Pull requests**: Full CI (no auto-fix)
- **Main branch**: Full CI + Deploy to production

## 🎨 Customization

### Change Node/pnpm Version
Edit `ci-cd.yml`:
```yaml
env:
  NODE_VERSION: '20'      # Change here
  PNPM_VERSION: '10.25.0' # Change here
```

### Add Dependabot Reviewers
Edit `dependabot.yml`:
```yaml
reviewers:
  - "your-github-username"
assignees:
  - "your-github-username"
```

### Modify Dependency Groups
Edit `dependabot.yml` → `groups` section

## 📚 Documentation

- **Full Documentation**: `.github/CI_CD_DOCUMENTATION.md`
- **Implementation Details**: `.github/IMPLEMENTATION_SUMMARY.md`
- **This Quick Reference**: `.github/QUICK_REFERENCE.md`

## 🆘 Support

1. Check workflow logs in Actions tab
2. Review documentation files
3. Check GitHub Actions documentation: https://docs.github.com/en/actions
4. Check Vercel documentation: https://vercel.com/docs

## ✅ Health Check

Verify CI/CD is working:
1. ✓ Push to feature branch → CI runs
2. ✓ Create PR to main → CI runs
3. ✓ Merge to main → CI runs + Deploys
4. ✓ Check Dependabot → Weekly PRs created
5. ✓ Manual auto-PR → Creates PR successfully
