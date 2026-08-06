-- Degis Tickets — baseline migration
--
-- Represents the schema as it exists today. It is marked as ALREADY APPLIED
-- against the production database (see NOTES), so this SQL never runs there.
-- From here on, every schema change is a reviewed, versioned migration file
-- instead of an automatic `db push --accept-data-loss`.

-- ============================ ENUMS ============================

CREATE TYPE "EventCategory" AS ENUM ('CONCERT', 'FOOTBALL', 'FESTIVAL', 'NIGHTLIFE', 'COMEDY', 'CONFERENCE', 'CULTURAL', 'CHURCH', 'OTHER');
CREATE TYPE "TierKind" AS ENUM ('GA', 'VIP', 'VVIP', 'EARLY_BIRD', 'STUDENT', 'TABLE');
CREATE TYPE "OrganizerStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE "EventReviewStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE "BusinessType" AS ENUM ('SOLE_PROPRIETOR', 'PLC', 'SHARE_COMPANY', 'NGO', 'ASSOCIATION', 'CHURCH', 'GOVERNMENT', 'OTHER');
CREATE TYPE "Role" AS ENUM ('ATTENDEE', 'ORGANIZER', 'ADMIN');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'REFUNDED');
CREATE TYPE "OrderChannel" AS ENUM ('ONLINE', 'BOX_OFFICE');
CREATE TYPE "ScanResult" AS ENUM ('ADMITTED', 'DUPLICATE', 'WRONG_EVENT', 'INVALID_SIGNATURE', 'EXPIRED_CODE', 'VOID_TICKET', 'UNKNOWN_TICKET', 'OVERRIDE_ADMITTED');
CREATE TYPE "TicketStatus" AS ENUM ('VALID', 'CHECKED_IN', 'VOID');

-- ============================ TABLES ============================

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'ATTENDEE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Organizer" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "OrganizerStatus" NOT NULL DEFAULT 'PENDING',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "legalName" TEXT,
    "businessType" "BusinessType" NOT NULL DEFAULT 'SOLE_PROPRIETOR',
    "tin" TEXT,
    "licenseNumber" TEXT,
    "licenseUrl" TEXT,
    "idDocUrl" TEXT,
    "city" TEXT NOT NULL DEFAULT 'Addis Ababa',
    "address" TEXT,
    "website" TEXT,
    "telegram" TEXT,
    "description" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "contactName" TEXT,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Organizer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Addis Ababa',
    "address" TEXT,
    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleAm" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "category" "EventCategory" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "coverImage" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "reviewStatus" "EventReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "organizerId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketTier" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "TierKind" NOT NULL DEFAULT 'GA',
    "priceEtb" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "sold" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TicketTier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "channel" "OrderChannel" NOT NULL DEFAULT 'ONLINE',
    "subtotalEtb" INTEGER NOT NULL,
    "serviceFeeEtb" INTEGER NOT NULL,
    "totalEtb" INTEGER NOT NULL,
    "deliveryPhone" TEXT NOT NULL,
    "chapaTxRef" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidSmsAt" TIMESTAMP(3),
    "entrySmsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceEtb" INTEGER NOT NULL,
    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "orderId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'VALID',
    "checkedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScannerDevice" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "gate" TEXT NOT NULL,
    "label" TEXT,
    "tokenHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScannerDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PairingCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "gate" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PairingCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScanRecord" (
    "id" TEXT NOT NULL,
    "clientScanId" TEXT NOT NULL,
    "ticketId" TEXT,
    "eventId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "gate" TEXT NOT NULL,
    "result" "ScanResult" NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScanRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- ============================ INDEXES ============================

CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE INDEX "OtpCode_phone_createdAt_idx" ON "OtpCode"("phone", "createdAt");

CREATE UNIQUE INDEX "Organizer_slug_key" ON "Organizer"("slug");
CREATE INDEX "Organizer_ownerId_idx" ON "Organizer"("ownerId");
CREATE INDEX "Organizer_status_idx" ON "Organizer"("status");

CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
CREATE INDEX "Event_startsAt_idx" ON "Event"("startsAt");
CREATE INDEX "Event_category_idx" ON "Event"("category");
CREATE INDEX "Event_organizerId_idx" ON "Event"("organizerId");
CREATE INDEX "Event_reviewStatus_idx" ON "Event"("reviewStatus");

CREATE UNIQUE INDEX "Order_chapaTxRef_key" ON "Order"("chapaTxRef");
CREATE INDEX "Order_status_expiresAt_idx" ON "Order"("status", "expiresAt");
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");
CREATE INDEX "Order_eventId_status_idx" ON "Order"("eventId", "status");

CREATE UNIQUE INDEX "Ticket_code_key" ON "Ticket"("code");
CREATE UNIQUE INDEX "Ticket_orderId_seq_key" ON "Ticket"("orderId", "seq");
CREATE INDEX "Ticket_eventId_status_idx" ON "Ticket"("eventId", "status");

CREATE UNIQUE INDEX "ScannerDevice_tokenHash_key" ON "ScannerDevice"("tokenHash");
CREATE INDEX "ScannerDevice_eventId_active_idx" ON "ScannerDevice"("eventId", "active");

CREATE UNIQUE INDEX "PairingCode_code_key" ON "PairingCode"("code");
CREATE INDEX "PairingCode_eventId_idx" ON "PairingCode"("eventId");

CREATE UNIQUE INDEX "ScanRecord_clientScanId_key" ON "ScanRecord"("clientScanId");
CREATE INDEX "ScanRecord_eventId_scannedAt_idx" ON "ScanRecord"("eventId", "scannedAt");
CREATE INDEX "ScanRecord_ticketId_idx" ON "ScanRecord"("ticketId");

CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- ============================ FOREIGN KEYS ============================

ALTER TABLE "Organizer" ADD CONSTRAINT "Organizer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Event" ADD CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Event" ADD CONSTRAINT "Event_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TicketTier" ADD CONSTRAINT "TicketTier_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "TicketTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "TicketTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScannerDevice" ADD CONSTRAINT "ScannerDevice_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PairingCode" ADD CONSTRAINT "PairingCode_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScanRecord" ADD CONSTRAINT "ScanRecord_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScanRecord" ADD CONSTRAINT "ScanRecord_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScanRecord" ADD CONSTRAINT "ScanRecord_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "ScannerDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
