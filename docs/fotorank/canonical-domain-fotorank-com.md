# Canonical domain decision — fotorank.com

**Date:** 2026-08-04  
**Decision owner:** organizer / product (FotoRank)

## Decision

Public canonical host is **https://fotorank.com**.

Previously `apps/fotorank/vercel.json` permanently redirected `fotorank.com` and `www.fotorank.com` to `https://fotorank.dnxsuite.com`. That inverted the preferred public brand domain.

## Current strategy

- `www.fotorank.com` → `https://fotorank.com` (permanent)
- No redirect from `fotorank.com` to `fotorank.dnxsuite.com`
- Staging / preview hosts remain on their own Vercel hostnames and are unaffected by this host-based rule
- App metadata should prefer `APP_URL` / `NEXT_PUBLIC_APP_URL` = `https://fotorank.com` in production

## Notes

- Ensure DNS + Vercel project domains attach `fotorank.com` (and www) to the FotoRank production deployment before cutting over.
- OAuth Google callback must match the public host: `/api/auth/google/callback` on `https://fotorank.com`.
