-- Ticket transfer: explicit ticket ownership + transfer audit trail

-- 1. Ownership column. Nullable at first so existing rows survive the add.
ALTER TABLE "Ticket" ADD COLUMN "ownerId" TEXT;

-- 2. Backfill: every existing ticket is owned by whoever placed the order.
UPDATE "Ticket" t
SET "ownerId" = o."userId"
FROM "Order" o
WHERE t."orderId" = o."id" AND t."ownerId" IS NULL;

-- 3. Transfer log
CREATE TABLE "TicketTransfer" (
    "id" TEXT NOT NULL,
    "fromTicketId" TEXT NOT NULL,
    "toTicketId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "toPhone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketTransfer_pkey" PRIMARY KEY ("id")
);

-- 4. Indexes
CREATE INDEX "Ticket_ownerId_idx" ON "Ticket"("ownerId");
CREATE INDEX "TicketTransfer_fromTicketId_idx" ON "TicketTransfer"("fromTicketId");
CREATE INDEX "TicketTransfer_toTicketId_idx" ON "TicketTransfer"("toTicketId");

-- 5. Foreign keys
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TicketTransfer" ADD CONSTRAINT "TicketTransfer_fromTicketId_fkey"
  FOREIGN KEY ("fromTicketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TicketTransfer" ADD CONSTRAINT "TicketTransfer_toTicketId_fkey"
  FOREIGN KEY ("toTicketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
