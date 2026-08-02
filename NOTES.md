# Phase 8 — Organizer onboarding, approvals & admin console

## ⚠️ Existing events will disappear from the homepage

`Event.published` now defaults to **false** and events need `reviewStatus =
APPROVED` plus an approved organizer to appear publicly. After deploying, go to
**/admin/events**, filter to DRAFT, and approve your existing test events. This
is the correct behaviour — nothing sells until a human says so — but it will
look like your catalog vanished if you're not expecting it.

## Set this before deploying

`ADMIN_PHONES` — comma-separated, e.g. `0911234567,0922334455`. Any of those
phone numbers becomes an ADMIN automatically on first visit to /admin. There is
deliberately no public "make me admin" endpoint.

## 1. Organizer application (replaces the old 2-field setup)

`/organizer/apply` — three steps:
1. **Business** — display name, registered legal name, business type
   (sole proprietor / PLC / share company / NGO / association / church /
   government), TIN, city, address, what they run
2. **Documents** — trade licence (required, PDF or photo), owner ID (optional)
3. **Contact & payout** — contact person, phone, email, Telegram, website, and
   the **bank account** (Ethiopian bank list, account name, account number)

"Sell on Degis" in the header now points here, and the page redirects to sign-in
first when needed. `/organizer/setup` redirects here so old links keep working.

## 2. Approval workflow

**Organizer:** PENDING → APPROVED / REJECTED / SUSPENDED
**Event:** DRAFT → PENDING_REVIEW → APPROVED / REJECTED

The rule: **approval gates selling, not building.** A PENDING organizer can
create events and configure tiers — they stay engaged during review and are
ready the moment you approve. Publishing puts the event in the review queue.

Enforced in three independent places (verified by test):
- event creation can't set `published` without an approved organizer
- the public homepage filters on both event and organizer approval
- **checkout refuses money** unless event AND organizer are both APPROVED

Suspending or rejecting an organizer immediately unpublishes all their events.

## 3. Admin console

| Page | |
|---|---|
| `/admin` | GMV, Degis revenue, 7-day GMV, users/organizers/events/tickets, "needs attention" queue, live events, audit trail |
| `/admin/organizers` | filter by status; full application detail with licence + ID documents, payout account, their GMV and fees, all their events, decision history |
| `/admin/events` | filter by review state; approve & publish, reject with a note, or unpublish |
| `/admin/lookup` | **the support desk** |

### The lookup page is the one you'll use most

One box takes a phone number, ticket code, order id, Chapa reference, or name.
Each result shows the order, buyer, whether SMS actually went out, and every
ticket with its status — plus the fix as a button:

- **Re-check payment with Chapa** — for "I paid but got nothing". Asks Chapa
  directly and settles a stuck PENDING order.
- **Resend ticket SMS** — for "I never got the message"
- **Reissue tickets** — paid order that somehow has no tickets
- **Void / restore ticket · undo check-in** — for disputes and gate mistakes
- **Refund & release seats** — voids tickets and returns inventory to sale
  (move the money in Chapa separately)

Every admin action is written to an **AuditLog** with actor, target, and note.

## 4. Organizer dashboard upgrades

- Nav: Dashboard · Orders · Settings
- Status banner explaining exactly what's blocked and what unlocks next
- Event rows show In review / Rejected / Draft / live
- **`/organizer/orders`** — filterable order table with buyer, tiers, totals,
  cash vs online, and a note that amounts shown are their earnings
- **`/organizer/settings`** — business details, payout account (number masked),
  documents on file, account status

## Verified

- Full production build: **compiled successfully**
- Type check clean on all new components
- Schema validation: 13 models, 10 enums, all accessors and enum literals valid,
  all relations have back-references
- **18/18 gating tests** against the real source: unapproved organizers can't
  publish or sell, suspended organizers are blocked at checkout even for
  previously-approved events, admin promotion requires ADMIN_PHONES

## Files

New: `lib/admin.ts`, `app/organizer/apply/*`, `app/organizer/orders/*`,
`app/organizer/settings/*`, all of `app/admin/*`, `app/api/admin/*`,
`app/api/organizer/apply/*`, `components/admin/*`,
`components/organizer/{ApplyForm,FileUpload,OrganizerNav,StatusBanner}.tsx`

Replaces: `prisma/schema.prisma`, `lib/organizer.ts`, `components/Header.tsx`,
`components/organizer/ImageUpload.tsx`, `app/page.tsx`, `app/organizer/page.tsx`,
`app/organizer/setup/page.tsx`, `app/api/checkout/route.ts`,
`app/api/upload/route.ts`, `app/api/organizer/events/route.ts`

## Worth doing next

- **Event editing** — organizers can create but not yet edit an event
- **Payout ledger** — what we owe each organizer, marked as settled
- **Promo codes** — organizers ask for these constantly
