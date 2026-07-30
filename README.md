# Degis Tickets — ድግስ

Premium ticketing platform for Ethiopian events. Complete codebase, Phases 0–5.

## What works today

- **Catalog & search** — Postgres-backed events, categories, Amharic + English titles
- **Auth** — phone OTP (dev mode shows codes on screen) and Google sign-in
- **Checkout** — Chapa: Telebirr, CBE Birr, cards; atomic inventory holds, 15-min expiry
- **Tickets** — Ed25519-signed QR codes, offline-verifiable, ticket wallet
- **Organizer** — self-serve onboarding, event creation, live metrics, sales chart,
  attendee CSV export, and box office mode for cash sales

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Prisma · Neon Postgres · Chapa · deployed on Vercel

## Environment variables (Vercel → Settings → Environment Variables)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | auto-added by the Neon integration |
| `DATABASE_URL_UNPOOLED` | yes | auto-added; used by `prisma db push` |
| `AUTH_SECRET` | yes | long random string; signs session cookies |
| `TICKET_SIGNING_SEED` | yes | long random string. **Never change it once real tickets are sold** — every issued QR would stop verifying |
| `OTP_DEV_MODE` | dev only | `true` shows OTP codes on screen instead of sending SMS |
| `CHAPA_SECRET_KEY` | yes | `CHASECK_TEST-…` for test mode |
| `CHAPA_WEBHOOK_SECRET` | optional | enables HMAC signature checks; payments are verified via Chapa's API regardless |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Google sign-in; redirect URI is `https://YOUR-DOMAIN/api/auth/google/callback` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` | optional | real SMS instead of dev mode |

**Env vars only take effect on the next deployment — after adding one, hit Redeploy.**
Check what the running app can see at `/api/health` (reports presence, never values).

## Chapa test credentials

Telebirr / CBE Birr: `0900123456` · M-Pesa: `0700123456` · Amole & Awash also take OTP `12345`
Cards: Visa `4200000000000000`, Mastercard `5400000000000000` — expiry `12/34`, CVV `123`

## Uploading this to GitHub

Uploads **merge** — they never delete. So remove stale files first:

1. Open the repo, press `.` to launch the browser editor
2. Delete the `app`, `components`, `lib`, and `prisma` folders, plus any stray
   `.ts`/`.tsx` files sitting at the repo root (keep `tailwind.config.ts` and `tsconfig.json`)
3. Commit & push
4. On github.com → **Add file → Upload files** → drag the four **folders**
   (`app`, `components`, `lib`, `prisma`) plus the root files from this zip
5. Commit — Vercel builds automatically

Always drag **folders**, never files from inside them: selecting files across
folders flattens everything to the repo root, which is how route code ends up
named `EventForm.tsx`.

Verify against `MANIFEST.txt` when you're done.

## Roadmap

- [x] Phase 0 — brand shell
- [x] Phase 1 — database, catalog, search
- [x] Phase 2 — phone OTP + Google auth
- [x] Phase 3 — Chapa checkout, inventory holds
- [x] Phase 4 — signed QR tickets, wallet
- [x] Phase 5 — organizer dashboard, box office
- [ ] Phase 6 — offline-first door scanner PWA
- [ ] Phase 7 — Telegram bot storefront
- [ ] Pre-launch — switch `prisma db push` to `prisma migrate`, add image uploads,
      real SMS provider, rotate all secrets
