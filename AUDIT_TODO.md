# CycleCare Audit — TODO

Audit date: 2026-10-10. Work through in the order of the "Suggested order" section.

## Suggested order

1. [x] Critical 1–2 — referral crash + handler error handling
2. [x] Shared Prisma client, bot username, "trial" copy, `**` Markdown fix
3. [x] Critical 5 — `/stop`, `/delete`, privacy page
4. [x] Timezone-correct dates + reliable daily send
5. [x] Critical 3–4 (email abuse / lock-out), then website polish

## 🔴 Critical

- [x] **Referral links crash the bot** — `src/bot/index.js` uses `prisma` without importing it. Any `/start` with a 6-char payload throws an unhandled rejection, which kills the process on Node 15+.
- [x] **No error handling in bot handlers** — none of the handlers in `commands.js`, `onboarding.js`, `pregnancy.js` catch errors; a DB error or a failed `sendMessage` (user blocked the bot) crashes the process. Wrap every handler, and add a `process.on('unhandledRejection')` safety net.
- [x] **Email lock-out** — emails are unverified and `User.email` is `@unique`. Someone who enters your email first makes your own onboarding fail at the last step. Verify emails or drop the unique constraint.
- [x] **Waitlist abuse** — `POST /api/waitlist` has no rate limit or server-side validation and re-sends the welcome email on every submit, so it can be used to spam any address from your domain. Add rate limiting and validation, and only email new leads.
- [x] **Privacy / GDPR** — stores third-party health data with no privacy policy, no `/delete`, no `/stop` (`paused`/`cancelled` statuses are never set). The site claims "100% Private".

## 🟠 Bugs & reliability

- [x] `/refer` link uses `CycleCareBot`; everywhere else uses `cycle_care_bot` → move to an env var (`commands.js:142`)
- [x] `/refer` copy says "14-day trial"; site says "Free Forever" (`commands.js:143`)
- [x] Day boundaries use server-local (UTC) time, not the user's timezone, so they can be off by a day; "today/yesterday" buttons are too (`cycle.js:12`, `periodStart.js:39`)
- [x] Ignored reminders → stuck on "Day 60 • Luteal • Fertility: Low" forever; keep nudging after the window, show overdue state (`reminders.js:21`, `cycle.js:33`)
- [x] Daily send needs an exact cron minute — a restart at send time means no message that day. Add `last_sent_date`, send when local time is at or past the chosen time (`daily.js:46`)
- [x] Scheduler loads every user from the DB every minute — filter in the query (`daily.js:31`)
- [x] Users who blocked the bot get an error every day → mark `cancelled` on 403 (`daily.js:85`)
- [x] `**bold**` doesn't render in Telegram legacy Markdown (`/weekends`, `/learn`)
- [x] `/today` always returns the same message for a phase — reuse `getDailyMessage` (`commands.js:52`)
- [x] `/learn` hard-codes 28-day ranges
- [x] 14–18 day cycles never show follicular/ovulation — raise the minimum to about 21 or handle short cycles
- [x] Onboarding accepts future or very old period dates (`onboarding.js:95`)
- [x] `period_duration` stored but unused (menstrual always 5 days)
- [x] `/webhook/telegram` route references undefined `bot` and has no secret — delete (`routes.js:6`)
- [x] Command regexes unanchored (`/update` matches `/updates`)
- [x] Emails > ~48 chars overflow Telegram's 64-char `start` param — use a short DB token instead
- [x] Re-running `/start` silently re-onboards and wipes `referred_by`

## 🟡 Infra & code health

- [x] 7 separate `PrismaClient` instances → one shared client (connection pool exhaustion)
- [x] Migrations are stale SQLite (`migration_lock.toml` = sqlite) while datasource is Postgres; `start` runs `db push`. Pick `prisma migrate deploy`.
- [x] `Procfile` and `npm start` disagree on `db push`
- [x] Polling fails with >1 instance (409) — switch to webhook + `secret_token` before scaling
- [x] Remove tracked `prisma/dev.db-journal` and one-off `fix-time.js`
- [x] Dead phase logic in `cycle.js:48-91`; "skip"/"/start" partner-name check duplicated 4×
- [x] Raw emails logged to console (`index.js:27`)

## 🔵 Website

- [x] Email is required to start — add a direct `t.me/cycle_care_bot` link
- [x] Mockup says "Fertility: Peak"; bot sends "High"
- [x] Add a "not contraception / medical advice" disclaimer (site + `/help`)
- [x] Pronoun voice inconsistent ("her" headline vs "them" body)
- [x] Add privacy policy + terms links, FAQ, Open Graph/Twitter tags
- [x] Email input has no `<label>`; no `prefers-reduced-motion` handling
- [x] 1.6 MB autoplay video with no `poster`; unused 414 KB `favicon.png`; logo → WebP
- [x] Form failure shows a raw Express error — add a friendly error page

## Follow-ups found during step 1

- [x] `onboarding.js` save-error path: if its own error `sendMessage` throws, `onboardingState.delete` is skipped and the chat stays stuck in onboarding — move the delete into a `finally`

## Notes from step 2

- Bot username now comes from `TELEGRAM_BOT_USERNAME` (falls back to `cycle_care_bot`). Set it in production env.
- `prisma/seed.js` still creates its own `PrismaClient`; it runs as a separate process, so that's fine.

## Notes from steps 3–5

### Deploying (do this once, in order)

1. **Baseline the production database before the first deploy.** Production was built with `db push`, so `prisma migrate deploy` (now in `npm start`) fails with P3005 until the existing schema is marked as migrated:
   ```
   DATABASE_URL=<prod url> npx prisma migrate diff --from-url "$DATABASE_URL" --to-migrations prisma/migrations --shadow-database-url <empty scratch db>   # optional sanity check
   DATABASE_URL=<prod url> npx prisma migrate resolve --applied 0_init
   ```
   The next deploy then applies `20261010000000_audit_fixes` automatically.
2. Set env vars: `PUBLIC_SITE_URL=https://cyclecare.foresttechsolutions.net` (no trailing slash), `TELEGRAM_BOT_USERNAME`, and `TRUST_PROXY` (1 behind Railway/Render). Optional: `TELEGRAM_WEBHOOK_URL` + `TELEGRAM_WEBHOOK_SECRET`.
3. Have the privacy policy and terms (`public/privacy.html`, `public/terms.html`) reviewed. They're drafts.

### Design decisions

- Email lock-out: dropped the unique constraint on `User.email` rather than adding verification.
- Daily send uses `next_send_at` (a UTC instant) instead of `last_sent_date`, so the per-minute query only loads users who are due. A slot is claimed before sending, so overlapping ticks can't double-send. A send that fails for reasons other than a block (403) is not retried that day (at most once).
- Calendar dates are stored as UTC midnight of the user's local date. Rows written before this change keep their stored UTC date, so some users east of UTC may show one day ahead until their next `/update`.
- Minimum cycle length is now 21. Existing users with shorter cycles keep working, but have no follicular phase.

### Known limitations (not fixed)

- Run **one instance only**. Onboarding, `/cyclelength` and "Another date" conversation state is held in memory. Webhook mode avoids polling conflicts but doesn't make scaling out safe.
- The rate limit keys on the full IP address. IPv6 clients could rotate addresses within a /64; express-rate-limit v8's `ipv6Subnet` would fix this.
- `public/og-image.jpg` is made from the old screenshot, which still says "Support them".
