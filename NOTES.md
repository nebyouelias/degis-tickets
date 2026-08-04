# Phase 9 — Event editing

Organizers could create an event but never fix it. This closes that.

## What organizers can now do

From the event dashboard → **Edit event**:
- Title (English + Amharic), description, category, date & time
- Event poster (re-upload)
- Venue name, city, address
- Ticket types: rename, reprice, change quantity, add new types, remove unsold ones
- Take the event off sale / put it back on sale
- Delete the event — only while nothing has been sold

## Guardrails (16/16 tests passing)

**Nothing can break an existing buyer's ticket.**

| Rule | Behaviour |
|---|---|
| Quantity below tickets sold | **Blocked** — "already has 40 sold, quantity can't go below that" |
| Quantity set exactly to sold | Allowed — this is how you close a tier |
| Removing a tier with sales | **Blocked**, with the advice to close it instead |
| Removing a tier with no sales | Allowed |
| Removing every tier | **Blocked** |
| Adding a new tier | Allowed |
| A tier id from another event | **Blocked** |
| Price change | Allowed — existing orders keep their snapshot price |
| Delete with tickets issued | **Blocked** — unpublish or ask support to cancel & refund |

The UI shows the sold count on each tier, sets the quantity field's minimum to it,
and disables Remove on tiers with sales — so organizers see the constraint before
they hit the error.

## Material changes re-trigger review

Changing **title, date or venue** on a live event sets `reviewStatus` back to
`PENDING_REVIEW` **while leaving it on sale** — buyers mid-purchase aren't
stranded, but the change lands in the admin queue. The organizer sees a notice
explaining this. Description, poster and price edits don't trigger review.

Every edit is written to the audit log; material ones are logged as
`EVENT_MATERIALLY_EDITED` with which fields changed.

## Editing while unapproved

A PENDING organizer editing an event keeps it unpublished and in review — the same
rule as creation. Rejected and suspended organizers are blocked from editing at all.

## Files

| Path | |
|---|---|
| `app/api/organizer/events/[id]/route.ts` | new — PATCH (update) and DELETE |
| `app/organizer/events/[id]/edit/page.tsx` | new — the edit page |
| `app/organizer/events/[id]/page.tsx` | replaces — adds the Edit event button |
| `components/organizer/EventEditForm.tsx` | new — form with sold-count guardrails |

No schema change. No new dependencies. No new environment variables.

## Verified

- Compiles clean; `EventEditForm` type-checks against the **ES5 target** your
  tsconfig uses (the setting that caused the `upload/route.ts` build failure)
- Scanned Phases 7–9 for the same ES5 iteration bug class — only the already-fixed
  `upload/route.ts` line was affected
- 16/16 guardrail tests: oversell prevention, tier removal rules, forged tier ids,
  material-change detection, delete protection

## Test it

1. Open an event with tickets sold → **Edit event**
2. Try setting a sold tier's quantity below the sold count → clear error
3. Try removing that tier → Remove is disabled with an explanation
4. Change the description → saves, stays live, no review flag
5. Change the date → saves, stays live, notice says Degis will re-check it;
   confirm it appears in `/admin/events?status=PENDING_REVIEW`
6. Create a throwaway event with no sales → Delete works
