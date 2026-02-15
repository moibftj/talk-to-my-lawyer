# Supabase Synchronization Report
**Project:** {{PROJECT_NAME}} ({{PROJECT_ID}})  
**Date:** {{DATE}}  
**Status:** {{STATUS}}

---

## Executive Summary

{{SUMMARY}}

---

## Migrations Applied

{{MIGRATIONS_LIST}}

---

## Storage Configuration

### Bucket: {{BUCKET_NAME}}
- **ID:** `{{BUCKET_ID}}`
- **Public:** `{{IS_PUBLIC}}`
- **File Size Limit:** {{FILE_SIZE_LIMIT}} bytes
- **Allowed MIME Types:** {{MIME_TYPES}}

### Storage RLS Policies

| Policy Name | Command | Role | Description |
|------------|---------|------|-------------|
{{STORAGE_POLICIES_TABLE}}

---

## RLS Policy Alignment

{{RLS_ALIGNMENT_SUMMARY}}

---

## External Service Integration

{{EXTERNAL_SERVICES}}

---

## Security Hardening

{{SECURITY_SUMMARY}}

---

## Performance Advisories

{{PERFORMANCE_ISSUES}}

---

## Next Steps

### Immediate Actions
{{IMMEDIATE_ACTIONS}}

### Recommended Optimizations
{{OPTIMIZATIONS}}

---

## Files Modified

{{FILES_MODIFIED}}

---

## Verification Commands

```bash
{{VERIFICATION_COMMANDS}}
```

---

## Conclusion

{{CONCLUSION}}

**Total Migrations Applied:** {{TOTAL_MIGRATIONS}}  
**Storage Buckets Created:** {{TOTAL_BUCKETS}}  
**RLS Policies Created:** {{TOTAL_POLICIES}}  
**Security Status:** {{SECURITY_STATUS}}  
**Data Flow Status:** {{DATA_FLOW_STATUS}}
