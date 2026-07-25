# Degis Tickets — ድግስ

Premium ticketing platform for Ethiopian events. Phase 0 scaffold.

## Stack
Next.js 14 (App Router) · TypeScript · Tailwind CSS · deployed on Vercel.
Phase 1 adds Neon Postgres + Prisma; Phase 3 adds Chapa payments.

## Run locally
```bash
npm install
npm run dev
```
Open http://localhost:3000

## Deploy
Push to GitHub → import the repo at vercel.com/new → Deploy. No env vars needed for Phase 0.

## Roadmap
- [x] Phase 0 — brand shell, live on Vercel
- [ ] Phase 1 — Neon Postgres + Prisma, real event catalog + event pages
- [ ] Phase 2 — phone OTP auth
- [ ] Phase 3 — checkout + Chapa (test mode) with inventory holds
- [ ] Phase 4 — QR tickets + wallet
- [ ] Phase 5 — organizer dashboard + box office mode
- [ ] Phase 6 — offline-first scanner PWA
- [ ] Phase 7 — Telegram bot storefront
