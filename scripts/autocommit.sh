#!/bin/bash

# Auto-commit script for Talk-To-My-Lawyer project
# This script stages all changes, commits them with a timestamp, and pushes to main

set -e

echo "🚀 Starting auto-commit process..."

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Check if there are any changes (including untracked files)
if git diff --quiet && git diff --staged --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
    echo "✅ No changes to commit"
    exit 0
fi

# Stage all changes
echo "📦 Staging all changes..."
git add -A

# Check if there are staged changes
if git diff --staged --quiet; then
    echo "✅ No staged changes to commit"
    exit 0
fi

# Get commit message from command line argument or use default
COMMIT_MSG="${1:-Auto-commit: $(date '+%Y-%m-%d %H:%M:%S')}"

echo "💾 Committing changes..."
echo "Commit message: $COMMIT_MSG"

# Commit changes
git commit -m "$COMMIT_MSG"

# Push to main branch
echo "🚀 Pushing to origin main..."
git push origin main

echo "✅ Auto-commit completed successfully!"
echo ""
echo "📋 Summary:"
git log --oneline -1
echo ""
echo "🔗 Repository: https://github.com/moizjmj-pk/talk-to-my-lawyer"