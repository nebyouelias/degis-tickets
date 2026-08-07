# Phase 12 — SMSEthiopia integration

One file changes: `lib/sms.ts`. No schema change, no new dependencies.

## Setup

1. Sign up at **smsethiopia.com** (100 free test SMS)
2. Dashboard → **Console → API Keys** → generate a key
3. Vercel → Environment Variables:
   - `SMSETHIOPIA_API_KEY` = your key
   - **Set `OTP_DEV_MODE` to `false`** (or delete it) — while it's on, nothing sends
4. **Redeploy** — env vars only apply to the next deployment

## What it does

```
POST https://smsethiopia.com/api/sms/send
KEY: <your api key>
Content-Type: application/json

{ "msisdn": "251911234567", "text": "..." }
```

Provider priority is now: dev mode → **SMSEthiopia** → AfroMessage → generic
webhook → Twilio. Switching providers later is env vars only, never code.

## The detail that would have broken it

SMSEthiopia wants the number **without** a leading `+` (`251911234567`), while
every other provider and our own normalizer use E.164 (`+251911234567`). The
adapter strips it at the boundary, so the rest of the app is unaffected.

## Verified (19/19 tests, real request intercepted)

- Endpoint, method, `KEY` header and `Content-Type` match their spec exactly
- Body contains **only** `msisdn` and `text`
- Phone conversion: `0911234567` → `251911234567`, `0711234567` (Safaricom
  Ethiopia) → `251711234567`, already-E.164 and spaced input all normalise
- A rejected send reports `delivered: false` with the provider's error text
- A network failure never throws — an SMS problem must never fail a payment
- Dev mode still overrides a configured provider (so staging stays silent)
- SMSEthiopia takes priority over AfroMessage when both are set

## Test sequence once the key is in

1. **OTP** — sign in with a real Ethiopian number, confirm the code arrives
2. **Payment** — buy a ticket, confirm the "payment confirmed" SMS
3. **Box office** — record a cash sale with a customer phone, confirm the codes SMS
4. **Transfer** — send a ticket, confirm the recipient is texted
5. **Entry alert** — the T-2h message; either wait, or hit
   `/api/cron/entry-ready?key=YOUR_CRON_SECRET` manually for an event starting
   within 2 hours

Watch your remaining free credits — that sequence uses about 5.

## Still to do on messaging

- **Sender ID**: request "DEGIS" so messages don't arrive from a random shortcode.
  Approval can take 5–14 business days in most African markets, and usually needs
  a letter on company letterhead — so it needs the entity first.
- **Hourly cron**: Vercel Hobby only runs cron once per day, which is too slow for
  T-2h alerts. Either upgrade to Pro, or point cron-job.org at
  `/api/cron/entry-ready?key=YOUR_CRON_SECRET` hourly.
- **Cost note**: templates are deliberately Latin-only. One Amharic character
  switches the message to UCS-2 — 70 characters per segment instead of 160.
