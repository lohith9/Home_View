# Security Review

Threat model for the current local-first architecture, plus the checklist that
activates when a backend exists. (SECURITY.md at repo root covers disclosure
policy; this document covers engineering posture.)

## Current attack surface (no backend, no auth)

| Area | Status | Finding |
|---|---|---|
| Input validation | OPEN | `importDesign`/`loadDesign` accept unvalidated JSON. A crafted design file can inject unexpected types (renderer crashes) or oversized arrays (tab DoS). Fix: schema validation on import - highest-priority security item. |
| XSS | OK so far | React escaping throughout; no `dangerouslySetInnerHTML` found in reviewed files (Canvas2D pending file review). Project name is user input rendered via React - safe by default. |
| Injection | N/A | No SQL/command surfaces; no eval/new Function found in reviewed files. |
| Storage | LOW | localStorage holds design data only - no secrets, no PII. Quota errors unhandled (robustness, not security). |
| Secrets | OK | None in repo; nothing to leak. Keep it that way: no API keys client-side, ever. |
| Dependencies | OK | 7 runtime deps, lockfile committed, CodeQL runs on push. Add Dependabot alerts + pinned action SHAs. |
| Supply chain | PARTIAL | Actions not SHA-pinned; no npm provenance checks. Low risk today, cheap to fix. |
| CSP | MISSING | Static hosting should send a Content-Security-Policy (default-src 'self'; no inline script needs expected with Vite build). |
| Sandboxing | N/A | No third-party embeds or plugins yet; revisit at plugin-API stage (10M-user column in ARCHITECTURE.md). |
| AuthN/AuthZ | N/A today | Becomes real at V2 (accounts): ownership checks live server-side only; the client is never trusted with authorization. |

## Rules going forward

1. Every file review includes the checklist above.
2. Any future import/export feature ships with schema validation in the same PR.
3. No dependency added without checking maintenance status and install-script behavior.
4. When the design-document service arrives: designs are user data - encrypt at rest, scope reads by owner, audit shares.

## Interview discussion

- Why client-side validation is a UX feature and server-side validation is the security boundary
- Why a floor-plan JSON import is still an attack surface (deserialization of untrusted data)
- CSP as defense-in-depth for a static SPA
