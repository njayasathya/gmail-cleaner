# Security Policy

## Local-First Threat Model & Privacy Design

Gmail Cleaner is designed to run **100% locally** on your machine or personal Docker host. No email metadata, OAuth credentials, or usage telemetry is ever transmitted to external third-party servers.

### Built-In Security Controls

1. **Credential & Data Isolation:**
   - OAuth credentials (`data/credentials.json`), access/refresh tokens (`data/token.json`), PKCE state (`data/oauth_state.json`), and the SQLite database (`data/cleaner.db`) live solely in `data/` (excluded via `.gitignore` and `.dockerignore`).
   - Secret files written on POSIX systems (macOS/Linux) are restricted with owner-only permissions (`0600`).
2. **Loopback Binding & Strict CORS:**
   - Local runs default to `HOST=127.0.0.1` so unauthenticated local endpoints are not exposed to external LAN interfaces unless explicitly configured.
   - CORS allows only explicit local origins (`localhost` / `127.0.0.1` on ports `8000` and `5173`).
3. **SSRF Protection on Unsubscribe Headers:**
   - Untrusted `List-Unsubscribe` URLs extracted from incoming emails are validated to ensure `http`/`https` schemes resolve strictly to public IP space, blocking loopback, private RFC 1918 subnets, and link-local metadata endpoints across initial requests and redirects.
4. **CSV Formula Injection Neutralization:**
   - Exported CSV reports escape untrusted header strings starting with `=`, `+`, `-`, `@`, tab, or carriage return characters.
5. **Path Traversal Guard:**
   - Static asset serving resolves target paths strictly within the built `frontend/dist` root.
6. **PKCE & OAuth Callback Note:**
   - Because Google OAuth desktop/local web callbacks commonly use `http://localhost:8000/api/auth/callback`, `OAUTHLIB_INSECURE_TRANSPORT=1` is enabled for localhost convenience. If you deploy behind a remote host or domain, terminate TLS via an HTTPS reverse proxy and remove insecure transport overrides.

## Reporting a Vulnerability

If you discover a security vulnerability, **please do not open a public GitHub issue** with exploit details.

Instead, report it privately using **GitHub Security Advisories** ("Report a vulnerability" under the repository's **Security** tab), or open a confidential contact request if advisories are unavailable. Include:

- Affected component or endpoint
- Steps to reproduce or proof-of-concept
- Potential impact and suggested mitigation (if known)

Please double-check before any pull request or issue report that you have not included `data/`, `.env`, tokens, client secrets, or personal email exports.
