# Phase 11 — Ticket transfer

Send a ticket to another phone number. The sender's copy dies, the recipient gets
a genuinely new ticket. This is the anti-fraud feature: when giving someone a
ticket is this easy, nobody needs to share a screenshot.

## ⚠️ This phase includes a migration — upload order matters

You are now on `prisma migrate deploy`, so a schema change needs its migration
file **committed in the same push** as the schema:

```
prisma/schema.prisma
prisma/migrations/20260806120000_ticket_transfer/migration.sql
```

Upload both together with the rest of the files. The build applies the migration
automatically and the log will say `1 migration applied`.

## The security reason for the design

The rotating entry code is derived from the **ticket id**, and the sender's phone
has that seed cached locally. If a transfer merely reassigned the same ticket,
the sender could keep generating valid entry codes offline after giving the
ticket away — and walk in ahead of the person they sent it to.

So a transfer **voids the original and issues a new ticket**: new id, new code,
new seed. Verified in tests: after transfer the sender can fetch neither the old
seed (ticket is void) nor the new one (not their ticket).

## Rules (19/19 tests passing)

| Rule | Behaviour |
|---|---|
| Not your ticket | 404 — no information leak |
| Already checked in | Blocked |
| Already void | Blocked |
| Event has started | Blocked — transfers close at doors |
| Your own number | Blocked |
| More than 3 transfers | Blocked — stops untracked resale chains |
| Tickets issued before this phase | Fall back to order buyer, so nothing breaks |

Every transfer is written to a `TicketTransfer` row (from/to ticket, from/to user,
phone, timestamp), so support can trace a ticket's full history.

## Ownership model

`Ticket.ownerId` is new and authoritative. The migration backfills it from each
order's buyer — verified against a live PostgreSQL database, existing tickets
correctly resolved to their purchaser.

Three places now use ownership rather than "who paid":
- the wallet list (`/tickets`)
- the single ticket page
- the entry-seed API — which is what actually enforces the security property

Void tickets are hidden from the wallet, so a sender doesn't see a dead stub.

## Recipient experience

They're texted: *"You have been sent a ticket for [event]. Code: DGS-XXXXXX.
Sign in with this number to see it."* If they don't have a Degis account, one is
created against their phone number — so the ticket is waiting when they first
sign in.

## Known limitation — offline scanners

A transfer made while a gate device is offline won't reach it until that device
syncs. In that window the old (now void) ticket could still scan as valid at that
specific gate. Devices sync every 10 seconds whenever they have signal, so the
window is small — but it's why transfers close once the event starts.

## Files

| Path | |
|---|---|
| `prisma/schema.prisma` | replaces — `Ticket.ownerId`, `TicketTransfer` model |
| `prisma/migrations/20260806120000_ticket_transfer/migration.sql` | new |
| `lib/issue-tickets.ts` | replaces — stamps `ownerId` at issuance |
| `app/api/tickets/[id]/transfer/route.ts` | new |
| `app/api/tickets/[id]/entry/route.ts` | replaces — ownership check |
| `app/tickets/page.tsx` | replaces — wallet by ownership |
| `app/tickets/[id]/page.tsx` | replaces — ownership + transfer UI |
| `components/TransferTicket.tsx` | new |

No new environment variables.

## Test it

1. Buy a ticket, open it, tap **Send this ticket to someone**
2. Enter a second phone number you control, confirm
3. Reload your wallet — the ticket is gone
4. Sign in with the other number — it's there, with a different `DGS-` code
5. Try to reopen the old ticket URL as the sender → 404
