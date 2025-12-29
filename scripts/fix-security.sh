#!/bin/bash

# Security Audit and Package Update Script
# This script addresses the security vulnerabilities found in the audit

echo "🔍 Starting security audit and package updates..."

echo "📋 Current security status:"
pnpm audit --audit-level=high || echo "Audit command failed - this is expected if dependencies aren't installed"

echo ""
echo "🔧 Attempting to fix security vulnerabilities..."

# Remove old installations
echo "Cleaning up old installations..."
rm -rf node_modules pnpm-lock.yaml

# Install with overrides to fix security issues
echo "Installing dependencies with security overrides..."
pnpm install

# Run audit to check if vulnerabilities are fixed
echo ""
echo "🔍 Checking security status after updates..."
pnpm audit --audit-level=high

echo ""
echo "📦 Checking for outdated packages..."
pnpm outdated

echo ""
echo "✅ Security audit script completed!"
echo ""
echo "If you still see vulnerabilities:"
echo "1. Check that the @modelcontextprotocol/sdk is >= 1.24.0 in pnpm-lock.yaml"
echo "2. Consider removing @mzxrai/mcp-webresearch if not essential"
echo "3. Update all dependencies: pnpm update --latest"
echo "4. Check for alternative packages that don't have vulnerabilities"