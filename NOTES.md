# Phase 7 — Image uploads + real SMS

## 1. Image uploads (Vercel Blob)

Organizers upload the poster from their phone instead of pasting a URL — this was
the single biggest blocker to onboarding a real promoter. JPG/PNG/WebP, 5 MB cap,
organizer-only, stored per organizer.

**Setup:** Vercel → Storage → Create → **Blob** → connect to the project. That
injects `BLOB_READ_WRITE_TOKEN`. Redeploy afterwards.
Until it's connected the uploader returns a clear "not configured yet" message
rather than failing silently.

## 2. Real SMS

Provider chosen by which env vars exist — switching gateways is configuration,
not code:

| Priority | Trigger | Provider |
|---|---|---|
| 1 | `OTP_DEV_MODE=true` | dev — logs to console, shows codes on screen |
| 2 | `AFROMESSAGE_TOKEN` | AfroMessage (Ethiopian, Ethio Telecom routes) |
| 3 | `SMS_WEBHOOK_URL` | generic POST — for whichever aggregator you sign |
| 4 | `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_FROM` | Twilio (good for testing) |

**Messages sent**
- **Payment confirmed** → ticket count, event, link to the wallet
- **Entry codes live** (T-2h) → "open Degis NOW while you have signal"
- **Box office sale** → ticket codes by text, when a customer phone was given

**Idempotency:** each send is claimed atomically on the order (`paidSmsAt`,
`entrySmsAt`) before dispatch, so webhook replays, the on-page verify path, and
overlapping cron runs can never double-text a buyer. A failed send clears the
claim so a later attempt retries.

**Cost note:** templates are Latin-only on purpose. One Amharic character forces
the whole SMS to UCS-2 — 70 characters per segment instead of 160, roughly 2.3x
the cost at volume. Amharic belongs in the app UI, not the SMS bill.

## 3. Entry-ready cron

`vercel.json` schedules `/api/cron/entry-ready` hourly.

⚠️ **Vercel Hobby only runs cron once per day.** Options:
- Upgrade to Pro for hourly, or
- Use a free external cron (cron-job.org) hitting
  `https://YOUR-DOMAIN/api/cron/entry-ready?key=YOUR_CRON_SECRET` hourly

Set `CRON_SECRET` either way — the route rejects unauthenticated calls when it's set.

## New environment variables

| Variable | Purpose |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | auto-added by Vercel Blob |
| `CRON_SECRET` | protects the entry-ready cron |
| `NEXT_PUBLIC_SITE_URL` | your real domain, used in SMS links |
| `AFROMESSAGE_TOKEN` / `AFROMESSAGE_SENDER` / `AFROMESSAGE_IDENTIFIER` | Ethiopian SMS |
| `SMS_WEBHOOK_URL` / `SMS_WEBHOOK_TOKEN` | generic aggregator |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` | Twilio |

Turn **off** `OTP_DEV_MODE` once a real provider is configured, or nothing sends.

## Verified

- Full production build: **compiled successfully**
- Type check clean on all new/changed files
- 5/5 SMS provider-selection tests: no-provider handled without throwing, dev
  mode takes priority, `OTP_DEV_MODE="TRUE"` still recognised (the Phase 2 bug
  can't come back), OTP wrapper throws only when genuinely unconfigured

## Files

| Path | |
|---|---|
| `prisma/schema.prisma` | replaces — adds `paidSmsAt`, `entrySmsAt` to Order |
| `package.json` | replaces — adds `@vercel/blob` |
| `next.config.mjs` | replaces — allows blob image hostnames |
| `vercel.json` | new — hourly cron |
| `lib/sms.ts` | replaces — multi-provider |
| `lib/notify.ts` | new — templates + idempotent sends |
| `app/api/upload/route.ts` | new |
| `app/api/cron/entry-ready/route.ts` | new |
| `app/api/webhooks/chapa/route.ts` | replaces — texts on payment |
| `app/api/organizer/box-office/route.ts` | replaces — texts walk-up buyers |
| `components/organizer/ImageUpload.tsx` | new |
| `components/organizer/EventForm.tsx` | replaces — uses the uploader |

## Still open

- **Apple/Google Wallet** — needs an Apple Developer membership ($99/yr) plus a
  Pass Type ID certificate, and a Google Wallet issuer account. Note the design
  constraint: wallet passes show a *static* barcode and can't rotate every 30s,
  so the pass should carry event info + `DGS-XXXXXX` + a link back to the app,
  with entry staying in Degis.
- **Ticket transfer** — removes the reason to share screenshots at all.
- **`prisma migrate`** — replace `db push --accept-data-loss` before real orders exist.
