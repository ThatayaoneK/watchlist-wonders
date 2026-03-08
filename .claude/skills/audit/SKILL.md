---
name: audit
description: Scans the watchlist-wonders codebase for security vulnerabilities and functional breaks. TRIGGER when: user asks to audit, review security, check for bugs or broken functionality, or runs /audit. DO NOT TRIGGER when: user asks about a single file fix or unrelated tasks.
context: fork
allowed-tools: Read, Grep, Glob, Bash
---

You are performing a comprehensive security and functionality audit of the **watchlist-wonders** project.

Stack: React 18 + TypeScript + Firebase (Auth, Firestore, Storage) + Vite + Tailwind + shadcn/ui + TanStack Query + React Router v7

Run all checks below, then produce a structured report. Do NOT fix anything — only report findings.

---

## PHASE 1 — SECURITY CHECKS

### 1.1 XSS Risks
Search for dangerous HTML injection patterns:
- `dangerouslySetInnerHTML` usage in all `.tsx` files
- Direct `.innerHTML =` assignments
- `eval(`, `new Function(`, `setTimeout(string`
Report each occurrence with file + line number.

### 1.2 Exposed Secrets / Hardcoded Credentials
Search for patterns that suggest hardcoded secrets in `src/`:
- Strings matching `sk-`, `AIza`, `key-`, `secret`, `password`, `Bearer ` followed by a token literal
- Any `.env` values hardcoded directly (not via `import.meta.env`)
- Firebase config values hardcoded outside of `src/lib/firebase.ts`
Also check if `.env` or `.env.local` files are tracked by git (`git ls-files | grep .env`).

### 1.3 Firebase Auth Bypass
Check every file in `src/services/` for Firestore/Storage operations:
- Any function that accesses `users/{uid}/...` — verify it receives `uid` as a parameter and does NOT fall back to a default or empty string
- Any Firestore write/read that skips auth checks (e.g., called before `auth.currentUser` is verified)
Check `src/components/ProtectedRoute.tsx` — verify it correctly blocks unauthenticated access to all sensitive routes in `src/App.tsx` or the router config.

### 1.4 Route-Level Auth Guard Coverage
Read the router configuration (likely in `src/App.tsx`). List every route and flag any that should be protected but are NOT wrapped in `ProtectedRoute` or equivalent.

### 1.5 Firebase Rules (if present)
Check for `firestore.rules` and `storage.rules` at the project root:
- Flag any rule that uses `allow read, write: if true;`
- Flag missing auth checks (`request.auth == null` not checked)
- Flag rules that don't scope data to `request.auth.uid`

### 1.6 Sensitive Data Exposure
- Check if user PII (email, uid, display name) is logged via `console.log` in production code
- Check if Firebase error objects are surfaced raw to the UI (could leak internal details)

---

## PHASE 2 — FUNCTIONAL BREAK CHECKS

### 2.1 TypeScript Compilation
Run: `npx tsc --noEmit 2>&1`
Report all errors with file + line. If clean, note that.

### 2.2 Environment Variables
Extract every `import.meta.env.VITE_` variable referenced in `src/`. Compare against:
- `.env.example` or `.env` at the project root (if it exists)
Flag any `VITE_` var used in code but not declared in env files. Specifically verify `VITE_ENRICH_URL` is present.

### 2.3 Enrich API Contract
Read `src/services/enrichment.ts` (and any caller like `src/pages/NewBookmark.tsx`).
Verify callers handle the correct response shape:
`{ title, description, posterUrl, backdropUrl, runtimeMinutes, releaseYear, mediaType, provider, tmdbId, error? }`
Flag any code checking for an `ok` field (that field does not exist) or expecting a different shape.

### 2.4 Firestore Service Error Handling
Read all files in `src/services/`. Flag:
- Firestore calls missing `.catch()` or `try/catch`
- Functions that return `void` but callers assume a return value
- `writeBatch` calls that don't commit or handle commit errors

### 2.5 Firebase Auth Field Usage
Search all `src/` files for `.user.id` or `user.created_at` — these are Supabase fields and will be `undefined` with Firebase. Firebase uses `user.uid` and `user.metadata.creationTime`. Flag every occurrence.

### 2.6 Broken or Missing Imports
Run: `npx tsc --noEmit 2>&1 | grep "Cannot find module"` to surface broken imports.
Also grep for any import paths referencing `@supabase` — these indicate leftover migration artifacts.

### 2.7 TanStack Query Key Consistency
Search `src/` for `useQuery`, `useMutation`, and `queryClient.invalidateQueries`. Flag cases where a mutation invalidates a query key that doesn't match any `useQuery` key (typos or stale key names).

### 2.8 Dead or Unreachable Service Calls
Check `src/services/` — flag any exported function that is never imported anywhere in `src/` (potential dead code from the Supabase migration).

---

## PHASE 3 — REPORT

Output the findings in this exact format:

---

# Audit Report — Watchlist Wonders
**Date:** [today's date]

## Summary
| Severity | Count |
|----------|-------|
| CRITICAL | N |
| HIGH     | N |
| MEDIUM   | N |
| LOW      | N |
| INFO     | N |

---

## Findings

For each finding use this block:

### [SEVERITY] — [Short Title]
**File:** `path/to/file.tsx:line`
**Category:** Security | Functional
**Detail:** One paragraph explaining the issue and why it matters.
**Recommendation:** What to do to fix it.

---

Severity definitions:
- **CRITICAL**: Can be exploited without auth, exposes secrets, or causes data loss
- **HIGH**: Auth bypass risk, broken core feature, or exposed sensitive data
- **MEDIUM**: Functional break in non-critical path, missing error handling that degrades UX
- **LOW**: Code smell, dead code, minor inconsistency
- **INFO**: Observation with no immediate risk

At the end, add a **Clean Checks** section listing every check that passed with no issues found.
