# CycleCare Audit — TODO

Audit date: 2026-10-10. Work through in the order of the "Suggested order" section.

## Suggested order

1. [x] Critical 1–2 — referral crash + handler error handling
2. [ ] Shared Prisma client, bot username, "trial" copy, `**` Markdown fix
3. [ ] Critical 5 — `/stop`, `/delete`, privacy page
4. [ ] Timezone-correct dates + reliable daily send
5. [ ] Critical 3–4 (email abuse / lock-out), then website polish

## 🔴 Critical

- [x] **Referral links crash the bot** — `src/bot/index.js` uses `prisma` without importing it. Any `/start` with a 6-char payload throws an unhandled rejection, which kills the process on Node 15+.
- [x] **No error handling in bot handlers** — none of the handlers in `commands.js`, `onboarding.js`, `pregnancy.js` catch errors; a DB error or a failed `sendMessage` (user blocked the bot) crashes the process. Wrap every handler, and add a `process.on('unhandledRejection')` safety net.
- [ ] **Email lock-out** — emails are unverified and `User.email` is `@unique`. Someone who enters your email first makes your own onboarding fail at the last step. Verify emails or drop the unique constraint.
- [ ] **Waitlist abuse** — `POST /api/waitlist` has no rate limit or server-side validation and re-sends the welcome email on every submit, so it can be used to spam any address from your domain. Add rate limiting and validation, and only email new leads.
- [ ] **Privacy / GDPR** — stores third-party health data with no privacy policy, no `/delete`, no `/stop` (`paused`/`cancelled` statuses are never set). The site claims "100% Private".

## 🟠 Bugs & reliability

- [ ] `/refer` link uses `CycleCareBot`; everywhere else uses `cycle_care_bot` → move to an env var (`commands.js:142`)
- [ ] `/refer` copy says "14-day trial"; site says "Free Forever" (`commands.js:143`)
- [ ] Day boundaries use server-local (UTC) time, not the user's timezone, so they can be off by a day; "today/yesterday" buttons are too (`cycle.js:12`, `periodStart.js:39`)
- [ ] Ignored reminders → stuck on "Day 60 • Luteal • Fertility: Low" forever; keep nudging after the window, show overdue state (`reminders.js:21`, `cycle.js:33`)
- [ ] Daily send needs an exact cron minute — a restart at send time means no message that day. Add `last_sent_date`, send when local time is at or past the chosen time (`daily.js:46`)
- [ ] Scheduler loads every user from the DB every minute — filter in the query (`daily.js:31`)
- [ ] Users who blocked the bot get an error every day → mark `cancelled` on 403 (`daily.js:85`)
- [ ] `**bold**` doesn't render in Telegram legacy Markdown (`/weekends`, `/learn`)
- [ ] `/today` always returns the same message for a phase — reuse `getDailyMessage` (`commands.js:52`)
- [ ] `/learn` hard-codes 28-day ranges
- [ ] 14–18 day cycles never show follicular/ovulation — raise the minimum to about 21 or handle short cycles
- [ ] Onboarding accepts future or very old period dates (`onboarding.js:95`)
- [ ] `period_duration` stored but unused (menstrual always 5 days)
- [ ] `/webhook/telegram` route references undefined `bot` and has no secret — delete (`routes.js:6`)
- [ ] Command regexes unanchored (`/update` matches `/updates`)
- [ ] Emails > ~48 chars overflow Telegram's 64-char `start` param — use a short DB token instead
- [ ] Re-running `/start` silently re-onboards and wipes `referred_by`

## 🟡 Infra & code health

- [ ] 7 separate `PrismaClient` instances → one shared client (connection pool exhaustion)
- [ ] Migrations are stale SQLite (`migration_lock.toml` = sqlite) while datasource is Postgres; `start` runs `db push`. Pick `prisma migrate deploy`.
- [ ] `Procfile` and `npm start` disagree on `db push`
- [ ] Polling fails with >1 instance (409) — switch to webhook + `secret_token` before scaling
- [ ] Remove tracked `prisma/dev.db-journal` and one-off `fix-time.js`
- [ ] Dead phase logic in `cycle.js:48-91`; "skip"/"/start" partner-name check duplicated 4×
- [ ] Raw emails logged to console (`index.js:27`)

## 🔵 Website

- [ ] Email is required to start — add a direct `t.me/cycle_care_bot` link
- [ ] Mockup says "Fertility: Peak"; bot sends "High"
- [ ] Add a "not contraception / medical advice" disclaimer (site + `/help`)
- [ ] Pronoun voice inconsistent ("her" headline vs "them" body)
- [ ] Add privacy policy + terms links, FAQ, Open Graph/Twitter tags
- [ ] Email input has no `<label>`; no `prefers-reduced-motion` handling
- [ ] 1.6 MB autoplay video with no `poster`; unused 414 KB `favicon.png`; logo → WebP
- [ ] Form failure shows a raw Express error — add a friendly error page

## Follow-ups found during step 1

- [ ] `onboarding.js` save-error path: if its own error `sendMessage` throws, `onboardingState.delete` is skipped and the chat stays stuck in onboarding — move the delete into a `finally`
