# TTML Agent System - Quick Reference

## 🎯 When to Use Each Agent

### TTML Architect
**Best for**: Strategic decisions, system design, security reviews, performance optimization

```
Use when:
✅ Designing new features
✅ Reviewing security implications
✅ Optimizing database queries
✅ Planning architectural changes
✅ Making technology choices
✅ Analyzing business logic

Example: "Design a webhook system for order status updates"
Example: "Review the rate-limiting strategy for potential edge cases"
Example: "Optimize the letter search query on the admin dashboard"
```

### MCP Manager
**Best for**: Finding code, understanding patterns, locating implementations

```
Use when:
✅ Locating specific functions/files
✅ Finding all usages of a pattern
✅ Understanding code relationships
✅ Searching across the codebase
✅ Analyzing repository history
✅ Tracking dependencies

Example: "Find all places where letter status is updated"
Example: "Show me every API route that checks for admin role"
Example: "List all email template definitions"
```

---

## 🔄 Agent Workflow

### Pattern 1: Explore → Design → Implement

```
1. MCP Manager: "Find all letter generation code"
   ↓ (Returns file locations and patterns)

2. TTML Architect: "Analyze this code structure and suggest improvements"
   ↓ (Provides design recommendations)

3. You: Implement the changes
   ↓

4. MCP Manager: "Find and verify all affected tests"
   ↓ (Confirms test coverage)
```

### Pattern 2: Debug → Locate → Fix

```
1. You: "We have a bug in the billing system"
   ↓

2. MCP Manager: "Find all subscription calculation code"
   ↓ (Returns relevant files)

3. TTML Architect: "Review this code for the bug"
   ↓ (Identifies issue)

4. You: Fix the code
```

### Pattern 3: Audit → Analyze → Secure

```
1. MCP Manager: "Find all database queries with user input"
   ↓ (Returns potential vulnerable code)

2. TTML Architect: "Security review this code for SQL injection risks"
   ↓ (Identifies vulnerabilities)

3. You: Apply security fixes
```

---

## 💡 Quick Examples

### Finding Code

**Q: Where is letter generation implemented?**
```
MCP Manager: Search for "generateTextWithRetry" in app/api and lib/ai
Returns: /app/api/generate-letter/route.ts, /lib/ai/openai-retry.ts
```

**Q: Show all API endpoints that require subscriber role**
```
MCP Manager: Grep for pattern matching subscriber role checks in app/api
Returns: List of files + line numbers with role validations
```

**Q: What are all the email templates?**
```
MCP Manager: Find template definitions in lib/email/templates.ts
Returns: All 20+ template definitions with signatures
```

### Analyzing Code

**Q: Is the rate limiting properly implemented?**
```
MCP Manager: Find all safeApplyRateLimit calls
↓
TTML Architect: Review implementation, check for edge cases, verify thresholds
Returns: Recommendations for improvements
```

**Q: How is letter approval workflow structured?**
```
MCP Manager: Find all letter status transitions in the codebase
↓
TTML Architect: Analyze state machine, identify edge cases, suggest improvements
Returns: Workflow diagram and optimization recommendations
```

### Optimizing

**Q: Are we doing N+1 queries anywhere?**
```
MCP Manager: Find all database queries in subscription endpoint
↓
TTML Architect: Analyze query patterns, identify N+1 issues, suggest fixes
Returns: Specific optimization recommendations
```

---

## 🚀 Preferred Commands

### Search for Code Patterns

```bash
# Find all rate-limiting usages
MCP: Search "safeApplyRateLimit" across app/api routes

# Find all RLS policy checks
MCP: Search "CREATE POLICY\|ALTER POLICY" in supabase/migrations

# Find all email queue operations
MCP: Search "queueTemplateEmail\|processEmailQueue" in lib/email

# Find all admin checks
MCP: Search "requireAdminAuth\|admin_sub_role" across app/api
```

### Analyze Patterns

```bash
# Review letter workflow
Architect: Analyze the complete letter lifecycle from generation to completion

# Audit security
Architect: Security review of authentication and authorization across all endpoints

# Optimize performance
Architect: Identify N+1 queries and suggest optimization strategy

# Validate RLS
Architect: Review Row-Level Security policies for coverage and correctness
```

---

## 📊 Common Tasks

### "I want to add a new email template"

```
1. MCP Manager: Show existing email templates structure
2. TTML Architect: Review best practices for template design
3. You: Create template following the pattern
4. MCP Manager: Verify template is properly exported
```

### "I need to add a new API endpoint"

```
1. TTML Architect: Design endpoint - auth, validation, response format
2. MCP Manager: Find similar endpoints to match patterns
3. You: Implement following TTML patterns
4. MCP Manager: Verify rate limiting and error handling
```

### "We need to optimize a slow query"

```
1. MCP Manager: Find the query implementation
2. TTML Architect: Analyze for N+1, missing indexes, inefficient joins
3. You: Implement optimizations
4. MCP Manager: Verify no regressions in dependent code
```

### "Security audit needed"

```
1. MCP Manager: Find all user input handling
2. TTML Architect: Review for OWASP vulnerabilities
3. You: Fix identified issues
4. MCP Manager: Verify fixes across codebase
```

---

## 🎓 Best Practices

### For MCP Manager
- ✅ Be specific with search patterns
- ✅ Limit scope to relevant directories
- ✅ Use appropriate output mode (content vs files_with_matches)
- ✅ Provide context around matches
- ✅ Cache common patterns

### For TTML Architect  
- ✅ Provide relevant code snippets
- ✅ Reference existing patterns in codebase
- ✅ Explain reasoning for recommendations
- ✅ Consider security-first approach
- ✅ Flag trade-offs clearly

### For Both
- ✅ Reference CLAUDE.md for project conventions
- ✅ Respect non-negotiables (RLS, subscriber-only, pnpm)
- ✅ Follow API pattern: Rate limit → Auth → Role → Validate → Logic
- ✅ Maintain security mindset
- ✅ Test assumptions before implementing

---

## 🔗 Key Resources

- **CLAUDE.md** - Project rules and conventions (start here!)
- **docs/ARCHITECTURE_AND_DEVELOPMENT.md** - Complete system design
- **docs/SECURITY.md** - Security policies and RLS
- **docs/DATABASE.md** - Schema and database design
- **lib/database.types.ts** - TypeScript type definitions
- **app/api/generate-letter/route.ts** - Gold standard API implementation

---

## 📞 When to Ask MCP Manager

- Where is X implemented?
- Find all usages of Y pattern
- Show me similar code to reference
- What files changed in commit Z?
- List all endpoints in Y category
- Find tests for X functionality
- Show repository statistics

## 📞 When to Ask TTML Architect

- Should we do X or Y?
- Review this code for issues
- Optimize this query/component
- Design a new feature
- Analyze security implications
- What are the trade-offs?
- How does this fit the architecture?

---

## ✨ Tips

1. **Stack tasks** - Ask MCP Manager to find code, then ask Architect to review it
2. **Reference patterns** - MCP can show you similar code to follow patterns
3. **Verify changes** - After implementation, ask MCP to find related tests
4. **Document findings** - Both agents can help document changes
5. **Iterate fast** - Use MCP to quickly find relevant code, Architect to refine design

---

**Last Updated**: 2026-01-16  
**Agents**: TTML Architect + MCP Manager  
**Status**: Active
