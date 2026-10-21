# Pulse — notes for working on this repo

Personal dashboard (Next.js 16 App Router, TypeScript, deployed on Vercel with Upstash Redis). Single user, password-gated.

- **Follow `PRINCIPLES.md`** for every feature: glance-first, zero manual input, two-tier notifications (urgent now / everything else in 3 digests + quiet hours), scores explain themselves, forgiving streaks.
- Data sources live in `lib/sources/*` and each fails independently via `run()` in `lib/dashboard.ts` — never let one source break the page.
- Pure logic (scoring, workload, notify rules, streaks, brief) has no I/O and is unit-tested in `lib/__tests__` — run `npm test` and `npm run typecheck` before pushing.
- `DEMO_MODE=1` renders realistic fake data (`lib/demo.ts`); `/?at=07:05` previews a time of day in demo mode. Keep demo data in sync when adding fields to `DashboardData`.
- Times: always go through `lib/time.ts` (`localTime`, `ymd`) — the server runs in UTC, the user is in Melbourne.
- Google: primary account = Fitbit/Health + calendar + Gmail; extra accounts = calendar + Gmail only (`lib/google.ts`, slot = email).
- Never commit secrets; config comes from env (`lib/config.ts`, `.env.example`).
