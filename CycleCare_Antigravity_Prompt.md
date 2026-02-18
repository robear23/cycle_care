# CycleCare — Antigravity Build Prompt

---

## Project Brief

Build the backend and Telegram bot for **CycleCare** — a daily notification service that helps partners support their loved ones through each phase of the menstrual cycle. The entire product is delivered through a Telegram bot. There is no native mobile app.

---

## What to Build

### 1. Telegram Bot (`/bot`)

A multi-tenant Telegram bot where all users share a single bot token. Each user is uniquely identified by their Telegram `chat_id`, which is captured automatically when they message the bot — users never need to find or enter their chat_id manually.

**Onboarding flow (conversational):**

When a user sends `/start`:
1. Bot replies: *"Welcome to CycleCare 💜 I'll send you a daily message to help you support your partner. First — what's their name? (or type 'skip' to keep messages generic)"*
2. Bot asks: *"When did their last period start? Just send me the date (e.g. '14 Feb')"*
3. Bot asks: *"What time would you like your daily message? (Default is 8AM — just type a time or press skip)"*
4. Bot asks: *"What's your timezone? (e.g. 'London', 'New York', 'Sydney')"*
5. Bot confirms setup and sends a Stripe payment link to activate the subscription
6. On payment confirmed (via Stripe webhook), mark account as active and confirm via bot message

**Supported commands:**
- `/start` — Begin onboarding
- `/update` — Update the cycle start date (e.g. period just started today)
- `/settings` — Change notification time, partner name, or cycle length
- `/pause` — Pause notifications
- `/resume` — Resume notifications  
- `/today` — Send today's message on demand
- `/phase` — Show current cycle phase and a brief explanation
- `/help` — List all commands
- `/delete` — Delete all user data (GDPR compliance)

---

### 2. Database (`/db`)

Use **PostgreSQL**. Create the following tables:

**`users`**
```sql
id                  SERIAL PRIMARY KEY
telegram_chat_id    TEXT UNIQUE NOT NULL
partner_name        TEXT
cycle_start_date    DATE NOT NULL
cycle_length        INTEGER DEFAULT 28
period_duration     INTEGER DEFAULT 5
notification_time   TIME DEFAULT '08:00'
timezone            TEXT DEFAULT 'UTC'
subscription_status TEXT DEFAULT 'trial'  -- trial | active | paused | cancelled
stripe_customer_id  TEXT
trial_ends_at       TIMESTAMP
created_at          TIMESTAMP DEFAULT NOW()
updated_at          TIMESTAMP DEFAULT NOW()
```

**`messages`**
```sql
id          SERIAL PRIMARY KEY
phase       TEXT NOT NULL  -- menstrual | follicular | ovulation | luteal | general
message_text TEXT NOT NULL  -- use [Partner] as placeholder for partner name
tone        TEXT           -- supportive | energetic | romantic | calm
created_at  TIMESTAMP DEFAULT NOW()
```

**`message_log`**
```sql
id          SERIAL PRIMARY KEY
user_id     INTEGER REFERENCES users(id)
message_id  INTEGER REFERENCES messages(id)
sent_at     TIMESTAMP DEFAULT NOW()
```

Seed the messages table with the full message library (see Message Content section below).

---

### 3. Cycle Phase Logic (`/lib/cycle.js` or `/lib/cycle.py`)

```
currentCycleDay = daysBetween(cycleStartDate, today) % cycleLength

Phase mapping (default 28-day):
  Days 1–5:   'menstrual'
  Days 6–13:  'follicular'
  Days 14–16: 'ovulation'
  Days 17–28: 'luteal'
```

Handle edge cases:
- Cycle rollover when today is past `cycleStartDate + cycleLength`
- Invalid or future start dates
- Leap years and month-end dates

---

### 4. Daily Notification Scheduler (`/scheduler`)

A cron job that runs every minute and checks which users are due a notification based on their `notification_time` and `timezone`.

For each due user:
1. Calculate current cycle day and phase
2. Query messages table for phase-appropriate messages not recently sent (check message_log)
3. Select a message randomly from the eligible pool
4. Replace `[Partner]` with the user's stored `partner_name` (or omit if not set)
5. Send message to user's `telegram_chat_id` via Telegram Bot API
6. Log the sent message in `message_log`

Fall back to 'general' phase messages if a user's phase-specific pool is exhausted.

---

### 5. Stripe Integration (`/payments`)

- On onboarding completion, generate a Stripe Payment Link and send it to the user via the bot
- Set up a `/webhook/stripe` endpoint to receive Stripe events
- On `checkout.session.completed` event: mark user as active, set `subscription_status = 'active'`
- On `customer.subscription.deleted` event: set `subscription_status = 'cancelled'`, send a friendly bot message
- Store `stripe_customer_id` on the user record

---

### 6. REST API (`/api`)

Build a minimal API for future web dashboard use:

```
POST /api/users              — Create/update user (called from bot)
GET  /api/users/:chatId      — Get user profile
PUT  /api/users/:chatId      — Update user settings
DELETE /api/users/:chatId    — Delete user (GDPR)
GET  /api/users/:chatId/phase — Get current phase info
POST /webhook/telegram        — Telegram webhook endpoint
POST /webhook/stripe          — Stripe webhook endpoint
```

---

## Tech Stack

Use whichever of these you're most comfortable generating clean, production-ready code for:

**Option A (Node.js):**
- Runtime: Node.js 20+
- Framework: Express.js
- Bot library: `node-telegram-bot-api`
- Database ORM: Prisma
- Scheduler: `node-cron`
- Stripe: `stripe` npm package

**Option B (Python):**
- Framework: FastAPI
- Bot library: `python-telegram-bot`
- Database ORM: SQLAlchemy + Alembic
- Scheduler: APScheduler
- Stripe: `stripe` pip package

Either option should include:
- `dotenv` for environment variables
- Proper error handling and logging
- A `docker-compose.yml` for local development with Postgres

---

## Environment Variables Required

```
TELEGRAM_BOT_TOKEN=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PAYMENT_LINK=
DATABASE_URL=
PORT=3000
NODE_ENV=development
```

---

## Message Content — Seed Data

Seed the `messages` table with the following. Use `[Partner]` as the name placeholder.

### Menstrual Phase (phase = 'menstrual')

1. "[Partner] is in their period — this can be physically draining and uncomfortable. Take something off their plate today without being asked. Even making tea, handling a chore, or just being quiet company matters more than you think."
2. "Today [Partner] might be dealing with cramps or fatigue. A warm drink, a hot water bottle, or simply asking 'is there anything you need?' can make a real difference. No grand gestures needed."
3. "Menstrual days can feel heavy — energy is low and emotions can run close to the surface. Just being patient and present is genuinely enough today."
4. "[Partner] might appreciate a low-key evening. Suggest their favourite show, skip the plans, and let them rest."
5. "Cramps are no joke. If [Partner] seems off today, it might not be about you — offer comfort first, questions later."
6. "A small act of service today — cooking dinner, picking up something they need, tidying up without being asked — will mean more than you realise."
7. "[Partner] may need extra rest right now. Create space for that without making it a big deal."
8. "Check in on [Partner] today with no agenda — just 'how are you feeling?' and actually listen to the answer."
9. "Today might call for a warm blanket, their favourite snack, and your company. Simple and enough."
10. "Hormones are at their lowest during the menstrual phase. [Partner] may feel more emotional or tired than usual — meet them with patience."

### Follicular Phase (phase = 'follicular')

1. "[Partner] is in the follicular phase — energy levels tend to rise and mood often lifts. A great time to suggest something fun or make plans together."
2. "Good energy day for [Partner]. If you've been meaning to plan something — a date night, a weekend trip, a new restaurant — bring it up today."
3. "The follicular phase often brings creativity and optimism. Ask [Partner] what they've been thinking about lately — they might have ideas they want to share."
4. "[Partner] is likely feeling more sociable right now. Plan something with friends or try something new together."
5. "This is a good phase to bring up something you've wanted to do as a couple. [Partner] is more likely to be open and enthusiastic."
6. "Compliment [Partner] on something specific today — their energy, something they've achieved, something you've noticed. Make it genuine."
7. "[Partner] may be feeling more confident and motivated. Be their hype person today."
8. "Suggest a spontaneous activity today — even just a walk somewhere new or a coffee at a place you haven't tried."
9. "The follicular phase is a good time for deeper conversations. [Partner] may be more open and communicative."
10. "Energy is rising for [Partner]. Match their vibe — be present, be playful, be engaged."

### Ovulation Phase (phase = 'ovulation')

1. "[Partner] is likely around ovulation — confidence and social energy are often at their peak. Tell them something specific you genuinely admire about them today."
2. "Today is a great day to make [Partner] feel seen. A genuine compliment, a spontaneous plan, or just your full, undivided attention goes a long way right now."
3. "Ovulation is often when [Partner] feels most like themselves. Celebrate that — plan something that makes them feel special."
4. "If there's something romantic you've been meaning to do, today is the day. [Partner] is likely at their most open and connected."
5. "[Partner] may be feeling vibrant and expressive right now. Engage with their energy — be curious, be present, be enthusiastic about them."
6. "Tell [Partner] something you love about them that you don't say enough. Not generic — something real and specific."
7. "This is a high-connection moment in the cycle. Make plans for quality time and follow through."
8. "[Partner] might be feeling their best right now. Celebrate it with them, not just for them."
9. "A date night, a thoughtful gesture, or even just putting your phone away for an evening — today it lands especially well."
10. "Ask [Partner] what they'd love to do this week and actually make it happen."

### Luteal Phase (phase = 'luteal')

1. "The luteal phase can bring mood shifts, fatigue, and heightened sensitivity for [Partner]. Your patience today is a form of love."
2. "[Partner] may be craving comfort right now — their favourite meal, a low-key evening, or just sitting together without your phone."
3. "If [Partner] seems more emotional or withdrawn today, try not to take it personally. Ask how they're doing and really listen."
4. "Take something off [Partner]'s plate today without waiting to be asked. It doesn't need to be big — just noticed."
5. "The luteal phase can feel heavy. Be the calm, steady presence [Partner] needs right now."
6. "Check in on [Partner] with warmth today. Not to fix anything — just to let them know you're paying attention."
7. "[Partner] might be craving their comfort foods. Surprise them — you know what they love."
8. "Suggest a relaxing evening. Think cosy, low-effort, no pressure. That's exactly what this phase calls for."
9. "Be extra patient today. [Partner] might be harder on themselves right now too."
10. "A hug without an agenda. Sometimes that's the whole thing."
11. "The pre-menstrual week can amplify stress. Look for one thing you can make easier for [Partner] today."
12. "Tell [Partner] you appreciate them — specifically, and without them having to ask."

### General Care (phase = 'general')

1. "Make [Partner] feel special today with a heartfelt, specific compliment."
2. "Surprise [Partner] with a small gesture — a note, a text, their favourite coffee."
3. "Plan a cozy evening to remind [Partner] how much they mean to you."
4. "Tell [Partner] one thing you're grateful for about them today."
5. "Ask [Partner] how they're really doing — and give them your full attention when they answer."
6. "Make [Partner] laugh today. Playfulness is underrated in long-term relationships."
7. "Do something for [Partner] without being asked and without mentioning it."
8. "Send [Partner] a message mid-day just to let them know you're thinking of them."
9. "Remind [Partner] why they're your favourite person. Say it out loud."
10. "Plan something to look forward to together — even something small."
11. "Put your phone down when you're with [Partner] tonight. Full presence is a gift."
12. "Tell [Partner] something specific you admire about them — not a compliment you say on autopilot."
13. "Do something that makes [Partner]'s evening easier — cook, clean up, handle something on the list."
14. "Share a favourite memory with [Partner]. Nostalgia builds closeness."
15. "Suggest a walk or a drive with no destination. Sometimes the best connection happens in-between."
16. "Ask [Partner] what they need this week — and actually try to provide it."
17. "Leave a note somewhere [Partner] will find it today."
18. "Make [Partner]'s morning easier. A small act before the day starts sets the whole tone."
19. "Tell [Partner] how they make your life better. Be specific."
20. "Plan a spontaneous date — doesn't need to be fancy, just intentional."

---

## Project Structure

```
cyclecare/
├── src/
│   ├── bot/
│   │   ├── index.js          # Bot init and webhook handler
│   │   ├── onboarding.js     # Onboarding conversation flow
│   │   └── commands.js       # Command handlers
│   ├── lib/
│   │   ├── cycle.js          # Phase calculation logic
│   │   └── messages.js       # Message selection logic
│   ├── scheduler/
│   │   └── daily.js          # Cron job for daily notifications
│   ├── payments/
│   │   └── stripe.js         # Stripe integration and webhook handler
│   ├── api/
│   │   └── routes.js         # REST endpoints
│   └── db/
│       ├── schema.sql         # Database schema
│       └── seed.sql           # Message library seed data
├── .env.example
├── docker-compose.yml
├── package.json
└── README.md
```

---

## Definition of Done

The MVP is complete when:

- [ ] A user can message the bot, complete onboarding in under 60 seconds, and receive a payment link
- [ ] After payment, the user receives their first daily message at their chosen time the next day
- [ ] The correct phase message is selected based on cycle start date
- [ ] Multiple simultaneous users each receive their own personalised messages
- [ ] `/update`, `/pause`, `/resume`, `/today`, `/phase`, `/settings`, `/help`, `/delete` all work correctly
- [ ] Stripe webhook correctly activates and deactivates accounts
- [ ] Message_log prevents the same message being repeated in consecutive days
- [ ] App runs cleanly with `docker-compose up` for local development
- [ ] Environment variables are documented in `.env.example`
- [ ] Basic error handling: failed Telegram sends are logged and retried, invalid dates are caught gracefully

---

## Notes for the Agent

- Keep the bot responses warm and human — avoid clinical or robotic language
- The `[Partner]` placeholder should be replaced at send time, not stored
- The message selection should weight toward messages not recently sent (last 7 days)
- Build the scheduler to be timezone-aware from day one — hardcoding UTC will cause problems at scale
- The Stripe integration should handle both one-time payment links (MVP) and recurring subscriptions (Phase 2 ready)
- Write the cycle logic as a pure function with unit tests — it's the most critical piece of business logic
