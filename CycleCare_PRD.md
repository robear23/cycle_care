# CycleCare – Product Requirements Document

**Version:** 1.0  
**Date:** February 2026  
**Status:** MVP Planning  

---

## 1. Product Overview

### 1.1 Vision

CycleCare is a Telegram-native daily notification service that helps partners show up with more empathy, care, and intention throughout their loved one's menstrual cycle. It is built exclusively for the partner — the person who wants to do better, not the person being tracked.

### 1.2 Problem

Most cycle-awareness tools require both people in a relationship to participate — the person with the cycle uses Flo, Clue, or similar apps, and the partner gets tacked on as a secondary viewer. This creates friction, requires the partner's loved one to opt in, and often results in the partner never engaging.

Existing "partner mode" solutions are either afterthoughts bolted onto female-facing apps, or apps like Selin that have a confused identity (marketed toward women, with a hidden men's section focused on fertility and intimacy planning rather than emotional support).

### 1.3 Solution

CycleCare is a Telegram bot that a partner signs up for independently. They enter their partner's cycle start date, and from that moment receive daily personalised messages — delivered in the messaging app they already use — explaining how their partner might be feeling and suggesting specific, actionable ways to show care. No native app install required. No need for the other person to participate.

### 1.4 Positioning

CycleCare is not a period tracker. It is a relationship support tool. The emotional intelligence and warmth of its messaging is the core differentiator — not data, not fertility, not logistics.

---

## 2. Target Audience

**Primary user:** Partners who want to be more supportive and emotionally present but don't always know how. This includes partners of any gender in any relationship configuration.

**Psychographic:** Thoughtful, relationship-invested, likely already doing small gestures but wanting to do them at the right times and in the right ways.

**Secondary consideration:** The person being supported never needs to use the product, though a future consent/sharing feature is planned.

---

## 3. Core Principles

**Empathy over data.** Every message should feel like it came from a thoughtful friend, not a health dashboard.

**No friction.** The onboarding must take under 60 seconds. No app download, no account creation beyond Telegram.

**Partner-first.** The person signing up is the hero. The product is designed around their experience of wanting to show up better.

**Privacy by default.** Cycle data is sensitive. It is stored securely, never sold, and never shared without explicit consent.

**Inclusive language.** All copy uses "partner" language and avoids gendered assumptions.

---

## 4. Technical Architecture

### 4.1 Stack

- **Backend:** Node.js (Express) or Python (FastAPI) — lightweight REST API
- **Database:** PostgreSQL — stores user profiles, cycle data, message library
- **Bot layer:** Telegram Bot API via `node-telegram-bot-api` or `python-telegram-bot`
- **Scheduler:** Node-cron or APScheduler — daily job to loop through all users and fire personalised messages
- **Hosting:** Railway or Render (simple, low-cost, scalable)
- **Payments:** Stripe — payment link sent via bot, webhook confirms activation

### 4.2 Data Model

**Users table**
- `id` (primary key)
- `telegram_chat_id` (unique — captured automatically on first message)
- `partner_name` (optional string)
- `cycle_start_date` (date)
- `cycle_length` (integer, default 28)
- `period_duration` (integer, default 5)
- `notification_time` (time, default 08:00)
- `timezone` (string)
- `subscription_status` (enum: trial, active, cancelled)
- `stripe_customer_id`
- `created_at`, `updated_at`

**Messages table**
- `id`
- `phase` (enum: menstrual, follicular, ovulation, luteal, general)
- `message_text` (with `[Partner]` placeholder)
- `tone` (enum: supportive, energetic, romantic, calm)

### 4.3 Cycle Phase Calculation

```
Current Cycle Day = (Today - Cycle Start Date) % Cycle Length

Phase mapping (default 28-day cycle):
  Days 1–5:   Menstrual
  Days 6–13:  Follicular
  Days 14–16: Ovulation
  Days 17–28: Luteal
```

Phase boundaries should be configurable per user in a future iteration.

### 4.4 Multi-Tenancy

One bot serves all users. Each user is identified by their unique Telegram `chat_id`, which is passed automatically when they message the bot. No user ever needs to know their chat_id. The daily cron job loops through all active subscribers, calculates their current phase, selects a message, and sends it to each user's `chat_id`.

---

## 5. User Journey

### 5.1 Discovery

User finds CycleCare via the landing page (cyclecare.app or similar), social media, or word of mouth. The landing page communicates the value proposition clearly and has a single CTA: "Start on Telegram."

### 5.2 Onboarding (Telegram Bot)

1. User clicks the Telegram deep link (e.g. `t.me/CycleCareBot`)
2. Telegram opens and user taps Start — bot captures `chat_id` automatically
3. Bot sends welcome message and asks three questions conversationally:
   - What is your partner's name? *(optional — skip to keep generic)*
   - When did their last period start? *(e.g. "14 Feb")*
   - What time would you like your daily message? *(default: 8AM — user can skip)*
4. Bot confirms setup: *"Great! Starting tomorrow at 8AM, I'll send you a daily message to help you support [Partner]."*
5. Bot sends payment link (Stripe) to activate subscription
6. On payment confirmation (via webhook), account is marked active

### 5.3 Daily Experience

Every day at the user's chosen time, the bot sends one message. The message follows a consistent structure:

- **What's happening:** A one-sentence explanation of where their partner likely is in their cycle
- **Why it matters:** Brief context on how this phase can affect mood, energy, or physical state
- **What to do:** One or two specific, actionable suggestions

Example (Luteal phase):
> *"[Partner] is likely in the luteal phase — progesterone is rising and she may be feeling more tired or emotionally sensitive than usual. This is a great time to take something off her plate without being asked. Could be as simple as making dinner, running an errand, or just putting your phone down and being fully present tonight."*

### 5.4 User Commands

Users can interact with the bot at any time:

- `/update` — Update cycle start date (e.g. period just started)
- `/settings` — Change notification time, partner name, cycle length
- `/pause` — Pause notifications temporarily
- `/resume` — Resume notifications
- `/today` — Get today's message on demand
- `/phase` — See what phase their partner is currently in with a brief explanation
- `/help` — List of available commands

---

## 6. Features

### 6.1 MVP (Phase 1)

**Telegram bot onboarding**
Conversational setup flow capturing partner name, cycle start date, and notification time. Chat_id captured automatically.

**Cycle phase calculation**
Daily calculation of current phase based on cycle start date and length. Handles cycle rollover correctly.

**Daily notifications**
Personalised daily message sent at user's chosen time. Message selected from phase-appropriate pool with randomisation to avoid repetition. Partner name interpolated into message text.

**Message library**
10+ messages per phase (menstrual, follicular, ovulation, luteal) plus 50+ general care messages. Rotate through library to prevent repetition.

**User commands**
`/update`, `/settings`, `/pause`, `/resume`, `/today`, `/phase`, `/help`

**Stripe payments**
Payment link sent via bot. Webhook activates subscription on successful payment.

**Landing page**
Simple, clean one-page site explaining the product with a single CTA to the Telegram bot. Handles SEO and social sharing.

### 6.2 Phase 2

**Timezone support**
Users set their timezone during onboarding to ensure messages arrive at the right local time.

**Cycle update reminders**
Bot proactively asks users to confirm or update the cycle start date each month, preventing drift in phase calculations.

**Educational content on demand**
Users can ask the bot to explain any phase (`/learn luteal`) and receive a clear, warm explanation of what's happening hormonally and physically.

**Subscription management**
Users can manage, pause, or cancel their subscription directly via the bot without needing a dashboard.

**Referral system**
Simple referral link to share CycleCare with friends. Incentive: one free month per successful referral.

### 6.3 Phase 3

**WhatsApp support**
Expand delivery channel to WhatsApp via the Meta Business API or Twilio. WhatsApp has significantly higher mainstream adoption and unlocks a much larger addressable market, particularly outside tech-savvy demographics.

**Web dashboard**
Lightweight web app for users who prefer to manage settings via browser. Handles payments, notification preferences, and cycle data updates.

**Partner consent & sharing (optional)**
Allow the partner with the cycle to optionally verify participation via a simple link. Unlocks a "connected" tier with potentially more accurate data and mutual transparency.

**AI-personalised messages**
Use an LLM (Claude API) to generate message variations dynamically, personalised to the user's relationship context, partner name, and user-provided preferences (e.g. "she loves cooking" or "he's been stressed at work").

---

## 7. Message Content

### 7.1 Menstrual Phase (Days 1–5)

Focus: Comfort, relief from tasks, low-key presence.

Sample messages:
- "[Partner] is in their period — physically it can be draining and uncomfortable. One of the best things you can do is take something off their plate today without being asked. Even small things like making tea, handling a chore, or just being quiet company matters."
- "Today [Partner] might be dealing with cramps or fatigue. A warm drink, a hot water bottle, or simply checking in with 'is there anything you need?' can make a real difference. No grand gestures needed."

### 7.2 Follicular Phase (Days 6–13)

Focus: Energy, adventure, new ideas, compliments.

Sample messages:
- "[Partner] is entering the follicular phase — energy levels tend to rise and mood often lifts. This is a great time to suggest something fun or make plans together. They're likely to be more receptive to new ideas and social activities."
- "Good energy day for [Partner]. If you've been meaning to plan something — a date night, a weekend trip, a new restaurant — now is a great time to bring it up."

### 7.3 Ovulation Phase (Days 14–16)

Focus: Confidence, connection, celebrating them.

Sample messages:
- "[Partner] is likely around ovulation — confidence and energy are often at their peak. Tell them something specific you admire about them today. Not generic — something you've actually noticed recently."
- "Today is a great day to make [Partner] feel seen. A genuine compliment, a spontaneous plan, or just your full attention goes a long way right now."

### 7.4 Luteal Phase (Days 17–28)

Focus: Patience, comfort, emotional presence, reducing load.

Sample messages:
- "The luteal phase can bring mood shifts, fatigue, and heightened sensitivity for [Partner]. Your patience today is a form of love. Try not to take anything personally and look for small ways to make their day easier."
- "[Partner] may be craving comfort right now. Their favourite meal, a low-key evening, or just sitting together without your phone can mean more than you'd expect."

### 7.5 General Care Messages (50+)

Rotating pool of warm, non-phase-specific messages for variety and for users who opt out of phase-specific messaging.

---

## 8. Pricing

### 8.1 MVP Pricing

**Free trial:** 7 days, no credit card required  
**Subscription:** £4.99/month or £39.99/year (~33% saving)

### 8.2 Future Tiers

| Tier | Price | Features |
|------|-------|----------|
| Basic | £4.99/mo | Daily Telegram notifications, cycle tracking, commands |
| Plus | £7.99/mo | AI-personalised messages, educational content, priority support |
| Couples | £9.99/mo | Partner consent flow, shared dashboard, connected mode |

---

## 9. Privacy & Compliance

Menstrual health data is sensitive and requires careful handling.

**Data minimisation:** Only collect what is needed to deliver the service (chat_id, cycle date, name, notification preferences).

**Encryption:** All data encrypted at rest and in transit.

**No third-party data sharing:** Cycle data is never sold to advertisers or shared with third parties.

**Right to deletion:** Users can delete all their data at any time via `/delete` command.

**GDPR compliance:** Required for EU users. Clear privacy policy, explicit consent at signup, right to access and erasure.

**Consent framing:** The landing page and onboarding clearly state that CycleCare is a support tool, not a surveillance tool, and encourages open communication with a partner about using the app.

---

## 10. Success Metrics

| Metric | MVP Target (Month 3) |
|--------|---------------------|
| Active subscribers | 200 |
| 30-day retention | >60% |
| Daily message open rate | >70% |
| Churn rate | <5% monthly |
| NPS | >50 |
| Referrals per user | >0.3 |

---

## 11. Risks & Mitigations

**Ethical misuse risk**
A tool that tracks someone's cycle without their knowledge could be misused in controlling relationships. Mitigation: Clear consent-encouraging copy in onboarding, future partner verification feature, transparent privacy policy.

**Telegram platform dependency**
Telegram could change their bot API or policies. Mitigation: Architecture designed to swap delivery channel — WhatsApp and email are planned alternatives.

**Cycle data accuracy**
Phase calculations are estimates based on user-inputted dates. Inaccurate data leads to irrelevant messages. Mitigation: Monthly check-in prompts, easy `/update` command, transparent messaging that these are estimates not certainties.

**App Store competitors**
Established apps like Flo could add a standalone partner bot. Mitigation: Move fast, build community and brand loyalty, focus on the tone and warmth that larger apps won't prioritise.

---

## 12. Go-To-Market

**Launch channel:** X/Twitter and relationship-focused subreddits (r/relationship_advice, r/Marriage). Frame as "the thing I built for myself."

**Content angle:** "I built a Telegram bot to help me be a better partner" — authentic founder story, shareable concept.

**SEO:** Long-tail keywords around "how to support partner during period", "menstrual cycle partner tips", "period support app for partners."

**Referral loop:** Every satisfied user is a potential advocate — the product is inherently shareable because the concept is novel and emotionally resonant.

---

## 13. Open Questions

- Should the free trial require a credit card upfront, or be truly free with a payment prompt at day 7?
- At what subscriber count does self-hosted infrastructure need to scale up?
- Should the bot allow users to optionally share that they use CycleCare with their partner, or keep it entirely private by default?
- Is there a meaningful B2B angle (relationship coaches, therapists recommending it to clients)?
