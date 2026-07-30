# Phase 6A-2 — Offline door scanner PWA

## What door staff do

1. Organizer opens the event dashboard → **Door scanners** → types a gate name →
   **Get code** → a 6-character code appears (valid 30 min, single use)
2. Door phone opens `/scan`, enters the code, names the device
3. The device downloads its offline toolkit: event secret, raw Ed25519 public key,
   full ticket manifest, and a server timestamp for clock correction
4. From then on it scans with **no internet at all**

## What the scanner decides, offline

| Scan | Result |
|---|---|
| Live app ticket | **ADMIT** (green) |
| Screenshot / stale code | EXPIRED CODE — "ask for the live code" |
| Already scanned, any gate | ALREADY USED — with the time it was admitted |
| Valid ticket for another event | WRONG EVENT |
| Forged or non-Degis QR | NOT VALID |
| Voided ticket | VOIDED |
| Paper box-office ticket (static `DGS1`) | **ADMIT** |
| Valid signature, not yet in manifest | **ADMIT** (issued after last sync) |

Green/red full-screen result, tier name, ticket code, and the holder's masked
phone in large type — so staff can ask for the last three digits.

## Verified (15/15 tests against the real verify module)

Ran `components/scanner/verify.ts` in Node against server-generated payloads:
screenshots from 10 minutes and 24 hours ago both rejected; duplicates, wrong
event, forged signatures, random QR codes, empty input, and a code borrowed from
another ticket all rejected; paper tickets and post-sync tickets admitted;
±45s device clock drift still admits.

Also verified separately:
- `@noble/ed25519` v3 verifies Node-generated signatures (2.15 ms per scan)
- WebCrypto HKDF + HMAC produce **byte-identical** output to Node's, so the
  browser derives exactly the same rotating codes as the server

## Fleet design (built for 50+ devices)

- Tokens are **per event and per gate**, stored hashed, revocable individually
- Every scan is stamped with device and gate
- Sync every 10s when there's any signal: pushes queued scans, pulls other gates'
  check-ins — so the cross-gate blind spot is seconds, not hours
- Sync is idempotent on a client-generated scan id: a device can retry the same
  batch after a dropped connection without double-recording
- Organizer panel shows per-gate device counts, scan counts, last-seen times,
  and a revoke button per device

## Dispute resolution

On a DUPLICATE the scanner shows **"Override — holder has a live code"**. Ask both
people to show their ticket refreshing: only the real holder's code moves. The
override is recorded as `OVERRIDE_ADMITTED` with device, gate, and timestamp, so
the incident is auditable afterwards.

## Fallbacks (nothing locks out a paying customer)

- **Manual entry**: type `DGS-XXXXXX` and check against the offline manifest —
  works with a dead customer phone
- **Bad device clock**: rotating check fails → the ticket still admits on
  signature + single-use, flagged in the record
- **Camera unavailable**: manual entry stays available
- **Service worker**: `/scan` opens with zero connectivity after first load

## Files

| Path | |
|---|---|
| `prisma/schema.prisma` | replaces — adds ScannerDevice, PairingCode, ScanRecord, ScanResult |
| `package.json` | replaces — adds `@noble/ed25519`, `jsqr` |
| `lib/ticket-crypto.ts` | replaces — adds `ticketPublicKeyRaw()` |
| `lib/scanner.ts` | new — pairing, manifest, device auth |
| `app/api/organizer/scanner/route.ts` | new — mint pairing codes, revoke devices |
| `app/api/scan/pair/route.ts` | new — redeem a code, hand over the offline toolkit |
| `app/api/scan/sync/route.ts` | new — idempotent push + cross-gate pull |
| `app/scan/page.tsx` | new — the scanner PWA |
| `components/scanner/store.ts` | new — IndexedDB (manifest, queue, cursor) |
| `components/scanner/verify.ts` | new — offline verification |
| `components/scanner/ScannerApp.tsx` | new — camera, results, sync, override |
| `components/scanner/RegisterServiceWorker.tsx` | new |
| `components/organizer/ScannerPanel.tsx` | new — fleet management |
| `app/organizer/events/[id]/page.tsx` | replaces — wires the panel in |
| `public/manifest.webmanifest`, `public/sw.js` | new — installable PWA |

## The acceptance test

1. Create an event starting ~1 hour out, buy 3 tickets, pair a phone to "Gate 1"
2. **Airplane mode on the scanner phone**
3. Scan ticket 1 → ADMIT. Scan it again → ALREADY USED
4. Screenshot ticket 2's code, wait 2 minutes, scan the screenshot → EXPIRED CODE.
   Then scan the live code → ADMIT
5. Scan a ticket from a different event → WRONG EVENT
6. Turn connectivity back on → the queue drains and the organizer dashboard
   check-in count matches exactly what you admitted

## Note on HTTPS

Camera access needs a secure context. Vercel is HTTPS, so `/scan` works on real
devices; `localhost` also counts as secure if you ever run it locally.
