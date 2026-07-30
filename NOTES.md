# Phase 6A-1 — Two-state tickets with rotating entry codes

## What this adds

**State 1 — Ticket pass** (purchase → 2 hours before doors)
A dimmed, deliberately non-barcode-looking QR that links to a PUBLIC verification
page, labelled "Not an entry code". Anyone offered a ticket on Telegram can scan
it and see whose ticket it is before paying.

**State 2 — Entry code** (2 hours before doors → end of event)
Ed25519 signature plus a rotating 8-character code that changes every 30 seconds,
with a live countdown bar. Generated on the holder's device, offline.

## Why late activation matters more than rotation

The seed needed to compute a valid entry code is only served to the authenticated
holder from T-2h onward. Before that, no valid entry code can exist anywhere —
not on our servers' output, not on any device. The advance screenshot-resale
market (which is where the scam you described happens, days before the event)
is eliminated outright, not merely detected.

## Key hierarchy

```
TICKET_SIGNING_SEED        server only, never leaves Vercel
  └─ eventSecret(eventId)  → that event's scanners, at pairing
       └─ ticketSeed(...)  → the holder only, only after activation
```

A scanner can verify any ticket for its own event, fully offline. It cannot touch
another event. A holder learns only their own ticket's seed.

## Verified behaviour (26/26 tests passing)

- Screenshot accepted at +45s (drift tolerance), DEAD at +2min, +1h, +1 day
- Scanner clock ±60s off: still works. ±3min off: rotating check fails, so the
  scanner falls back to signature-only rather than refusing entry
- Codes from another event or another ticket: rejected
- Tampered ticket id / signature / garbage input: rejected
- Derivation is deterministic across restarts and deploys
- 1.1 trillion code space (8 chars, 32-symbol alphabet)

## Files

| Path | Purpose |
|---|---|
| `lib/ticket-crypto.ts` | replaces existing — key hierarchy, rotation, activation, payload parsing |
| `components/TicketEntryCode.tsx` | new — client-side rotating QR, WebCrypto HMAC, offline cache |
| `app/api/tickets/[id]/entry/route.ts` | new — serves the seed, enforces ownership + activation window |
| `app/tickets/[id]/page.tsx` | replaces — the two states |
| `app/t/[id]/page.tsx` | new — public verification page |
| `app/tickets/page.tsx` | replaces — wallet list shows "Entry unlocks in Xh" |

No new dependencies. No new environment variables. No schema change.

Optional: set `NEXT_PUBLIC_SITE_URL` to your domain so pass QRs point at it
(defaults to the vercel.app URL).

## Testing it

1. Existing seeded events are weeks out → tickets show **State 1**. Scan the pass
   QR with your phone camera: you land on the public verification page showing the
   masked holder phone and the "grants no entry" warning.
2. To see **State 2**, create an event starting ~1 hour from now in the organizer
   dashboard, buy a ticket, and open it — live rotating code with countdown.
3. Screenshot that code, wait two minutes, and compare it to the live one. The
   captured code is already dead. (The scanner enforces this in 6A-2.)
4. Airplane mode after loading once: the code keeps rotating from the cached seed.

## Known gap — box office paper tickets

Rotating codes need the app. Box office walk-ups may have no smartphone, so those
tickets stay static (`DGS1` payload, which the scanner accepts). Still to build:
an organizer-only print view for a static ticket. Protection for those relies on
single-use enforcement plus the phone-digit check at the gate.

## Next: 6A-2

Scanner PWA — camera scanning, offline Ed25519 + rotating verification, device
pairing per gate, local duplicate rejection, and sync-on-reconnect.
