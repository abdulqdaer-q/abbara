-- CreateExtension
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CREATED', 'TENTATIVELY_ASSIGNED', 'ASSIGNED', 'ACCEPTED', 'ARRIVED', 'LOADED', 'EN_ROUTE', 'DELIVERED', 'COMPLETED', 'CLOSED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('OFFERED', 'TENTATIVE', 'ACCEPTED', 'REJECTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WaypointStatus" AS ENUM ('PENDING', 'ARRIVED', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('PRE_MOVE', 'POST_MOVE', 'DAMAGE', 'SIGNATURE', 'OTHER');

-- CreateEnum
CREATE TYPE "OrderEventType" AS ENUM ('CREATED', 'UPDATED', 'ASSIGNED', 'TENTATIVELY_ASSIGNED', 'ACCEPTED', 'REJECTED', 'ARRIVED', 'LOADED', 'EN_ROUTE', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'FAILED', 'WAYPOINT_UPDATED', 'EVIDENCE_UPLOADED', 'OFFER_SENT', 'OFFER_EXPIRED', 'ASSIGNMENT_REVOKED');

-- CreateEnum
CREATE TYPE "CancellationReason" AS ENUM ('CUSTOMER_REQUEST', 'PORTER_UNAVAILABLE', 'PRICING_ISSUE', 'FRAUD_DETECTED', 'DUPLICATE_ORDER', 'CUSTOMER_NO_SHOW', 'WEATHER', 'VEHICLE_ISSUE', 'OTHER');

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'CREATED',
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "porterCountRequested" INTEGER NOT NULL DEFAULT 1,
    "porterCountAssigned" INTEGER NOT NULL DEFAULT 0,
    "vehicleType" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "specialInstructions" TEXT,
    "paymentMethodHint" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancellationReason" "CancellationReason",
    "cancellationFeeCents" INTEGER,
    "isDisputed" BOOLEAN NOT NULL DEFAULT false,
    "isFraudFlagged" BOOLEAN NOT NULL DEFAULT false,
    "isBusinessOrder" BOOLEAN NOT NULL DEFAULT false,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringPattern" TEXT,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_stops" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DECIMAL(10,8) NOT NULL,
    "lng" DECIMAL(11,8) NOT NULL,
    "stopType" TEXT NOT NULL,
    "status" "WaypointStatus" NOT NULL DEFAULT 'PENDING',
    "arrivalTimestamp" TIMESTAMP(3),
    "departureTimestamp" TIMESTAMP(3),
    "contactName" TEXT,
    "contactPhone" TEXT,
    "instructions" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "lengthCm" DECIMAL(10,2),
    "widthCm" DECIMAL(10,2),
    "heightCm" DECIMAL(10,2),
    "weightKg" DECIMAL(10,2),
    "photos" JSONB,
    "isFragile" BOOLEAN NOT NULL DEFAULT false,
    "isHeavy" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_assignments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "porterId" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'OFFERED',
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "earningsCents" INTEGER,
    "earningsBreakdown" JSONB,
    "deviceId" TEXT,
    "sessionId" TEXT,
    "rejectionReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "eventType" "OrderEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT,
    "lat" DECIMAL(10,8),
    "lng" DECIMAL(11,8),
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_evidences" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "url" TEXT NOT NULL,
    "checksum" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_pricing_snapshots" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "baseFareCents" INTEGER NOT NULL,
    "distanceFareCents" INTEGER NOT NULL,
    "timeFareCents" INTEGER NOT NULL,
    "porterFeesCents" INTEGER NOT NULL,
    "surgeMultiplier" DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    "taxCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "estimatedDistanceKm" DECIMAL(10,2),
    "estimatedTimeMinutes" INTEGER,
    "pricingVersion" TEXT,
    "breakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_pricing_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

-- CreateIndex
CREATE INDEX "orders_scheduledAt_idx" ON "orders"("scheduledAt");

-- CreateIndex
CREATE INDEX "orders_customerId_status_idx" ON "orders"("customerId", "status");

-- CreateIndex
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX "order_stops_orderId_idx" ON "order_stops"("orderId");

-- CreateIndex
CREATE INDEX "order_stops_lat_lng_idx" ON "order_stops"("lat", "lng");

-- CreateIndex
CREATE UNIQUE INDEX "order_stops_orderId_sequence_key" ON "order_stops"("orderId", "sequence");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "order_assignments_orderId_idx" ON "order_assignments"("orderId");

-- CreateIndex
CREATE INDEX "order_assignments_porterId_idx" ON "order_assignments"("porterId");

-- CreateIndex
CREATE INDEX "order_assignments_status_idx" ON "order_assignments"("status");

-- CreateIndex
CREATE INDEX "order_assignments_porterId_status_idx" ON "order_assignments"("porterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "order_assignments_orderId_porterId_key" ON "order_assignments"("orderId", "porterId");

-- CreateIndex
CREATE INDEX "order_events_orderId_idx" ON "order_events"("orderId");

-- CreateIndex
CREATE INDEX "order_events_orderId_createdAt_idx" ON "order_events"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "order_events_eventType_idx" ON "order_events"("eventType");

-- CreateIndex
CREATE INDEX "order_events_correlationId_idx" ON "order_events"("correlationId");

-- CreateIndex
CREATE INDEX "order_evidences_orderId_idx" ON "order_evidences"("orderId");

-- CreateIndex
CREATE INDEX "order_evidences_type_idx" ON "order_evidences"("type");

-- CreateIndex
CREATE UNIQUE INDEX "order_pricing_snapshots_orderId_key" ON "order_pricing_snapshots"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_requestHash_key" ON "idempotency_keys"("requestHash");

-- CreateIndex
CREATE INDEX "idempotency_keys_expiresAt_idx" ON "idempotency_keys"("expiresAt");

-- AddForeignKey
ALTER TABLE "order_stops" ADD CONSTRAINT "order_stops_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_assignments" ADD CONSTRAINT "order_assignments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_evidences" ADD CONSTRAINT "order_evidences_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_pricing_snapshots" ADD CONSTRAINT "order_pricing_snapshots_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
