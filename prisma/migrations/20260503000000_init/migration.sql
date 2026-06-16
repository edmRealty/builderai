-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'PROJECT_MANAGER', 'ACCOUNTANT', 'FIELD_AGENT', 'BANKER', 'ADMIN');

-- CreateEnum
CREATE TYPE "QBConnectionType" AS ENUM ('QBO', 'QBD');

-- CreateEnum
CREATE TYPE "QBConnectionStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ERROR');

-- CreateEnum
CREATE TYPE "IntegrationEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'ERROR');

-- CreateEnum
CREATE TYPE "QbdInstructionStatus" AS ENUM ('PENDING', 'ACKED', 'DONE', 'ERROR');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'UNDER_CONSTRUCTION', 'COMPLETED', 'FOR_SALE', 'RENTAL_READY');

-- CreateEnum
CREATE TYPE "CommitmentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'INVOICED', 'PAID');

-- CreateEnum
CREATE TYPE "DrawStatus" AS ENUM ('DRAFT', 'READY_FOR_BANK_REVIEW', 'NEEDS_INFO', 'REJECTED', 'APPROVED', 'FUNDED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('INVOICE', 'LIEN_WAIVER', 'W9', 'COI', 'PLAN', 'PERMIT', 'ABATEMENT', 'INSPECTION', 'CONTRACT', 'OTHER');

-- CreateEnum
CREATE TYPE "PermitStatus" AS ENUM ('APPLIED', 'ISSUED', 'EXPIRED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AbatementStatus" AS ENUM ('ACTIVE', 'PENDING', 'EXPIRED', 'TERMINATED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecretEnc" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "MfaChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LLC" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "einEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LLC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickBooksConnection" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "llcId" TEXT NOT NULL,
    "type" "QBConnectionType" NOT NULL,
    "status" "QBConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "displayName" TEXT NOT NULL,
    "qboRealmId" TEXT,
    "qboAccessTokenEnc" TEXT,
    "qboRefreshTokenEnc" TEXT,
    "qboTokenExpiresAt" TIMESTAMP(3),
    "qbdCompanyFileName" TEXT,
    "qbdAgentKeyEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickBooksConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "llcId" TEXT NOT NULL,
    "qbConnectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "unitCount" INTEGER,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "budgetTotalCents" INTEGER,
    "qbProjectRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAssignment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "w9OnFile" BOOLEAN NOT NULL DEFAULT false,
    "w9ExpiresAt" TIMESTAMP(3),
    "coiOnFile" BOOLEAN NOT NULL DEFAULT false,
    "coiExpiresAt" TIMESTAMP(3),
    "approvedVendor" BOOLEAN NOT NULL DEFAULT true,
    "performanceScore" DOUBLE PRECISION,
    "qbVendorRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commitment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "costCode" TEXT NOT NULL,
    "agreedCents" INTEGER NOT NULL,
    "retainageBps" INTEGER NOT NULL DEFAULT 0,
    "status" "CommitmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startDate" TIMESTAMP(3),
    "targetCompleteDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "paidToDateCents" INTEGER NOT NULL DEFAULT 0,
    "invoicedNotPaidCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpectedInvoice" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "commitmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ExpectedInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorInvoiceRequest" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "commitmentId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenEnc" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "vendorEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorInvoiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorInvoiceUpload" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "notes" TEXT,
    "invoiceDocId" TEXT,
    "lienWaiverDocId" TEXT,
    "w9DocId" TEXT,
    "coiDocId" TEXT,
    "qbBillRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorInvoiceUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectUpdate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tags" TEXT[],
    "photoDocIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "commitmentId" TEXT,
    "vendorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permit" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "permitType" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "permitNumber" TEXT,
    "status" "PermitStatus" NOT NULL DEFAULT 'APPLIED',
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Abatement" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "programName" TEXT NOT NULL,
    "status" "AbatementStatus" NOT NULL DEFAULT 'PENDING',
    "termStart" TIMESTAMP(3),
    "termEnd" TIMESTAMP(3),
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Abatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanSet" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "superseded" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bank" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "loanNumber" TEXT,
    "retainageBpsDefault" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanBanker" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "LoanBanker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrawTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawRequest" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" "DrawStatus" NOT NULL DEFAULT 'DRAFT',
    "lockedAt" TIMESTAMP(3),
    "deliveryEmailTo" TEXT[],
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedComment" TEXT,
    "fundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrawRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawLineItem" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "drawRequestId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "costCode" TEXT,
    "scheduledCents" INTEGER,
    "previousDrawCents" INTEGER DEFAULT 0,
    "thisDrawCents" INTEGER DEFAULT 0,
    "retainageCents" INTEGER DEFAULT 0,
    "percentComplete" INTEGER,
    "commitmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrawLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickBooksTxn" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "qbConnectionId" TEXT NOT NULL,
    "qbEntityType" TEXT NOT NULL,
    "qbEntityId" TEXT NOT NULL,
    "projectId" TEXT,
    "vendorId" TEXT,
    "commitmentId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "txnDate" TIMESTAMP(3),
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuickBooksTxn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "qbConnectionId" TEXT NOT NULL,
    "status" "IntegrationEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QbdInstruction" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "qbConnectionId" TEXT NOT NULL,
    "status" "QbdInstructionStatus" NOT NULL DEFAULT 'PENDING',
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "error" TEXT,

    CONSTRAINT "QbdInstruction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "MfaChallenge_tokenHash_key" ON "MfaChallenge"("tokenHash");

-- CreateIndex
CREATE INDEX "AuditEvent_orgId_createdAt_idx" ON "AuditEvent"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "LLC_orgId_idx" ON "LLC"("orgId");

-- CreateIndex
CREATE INDEX "QuickBooksConnection_orgId_idx" ON "QuickBooksConnection"("orgId");

-- CreateIndex
CREATE INDEX "QuickBooksConnection_llcId_idx" ON "QuickBooksConnection"("llcId");

-- CreateIndex
CREATE INDEX "Project_orgId_idx" ON "Project"("orgId");

-- CreateIndex
CREATE INDEX "Project_llcId_idx" ON "Project"("llcId");

-- CreateIndex
CREATE INDEX "Project_qbConnectionId_idx" ON "Project"("qbConnectionId");

-- CreateIndex
CREATE INDEX "ProjectAssignment_orgId_idx" ON "ProjectAssignment"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAssignment_projectId_userId_key" ON "ProjectAssignment"("projectId", "userId");

-- CreateIndex
CREATE INDEX "Vendor_orgId_idx" ON "Vendor"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Commitment_code_key" ON "Commitment"("code");

-- CreateIndex
CREATE INDEX "Commitment_orgId_idx" ON "Commitment"("orgId");

-- CreateIndex
CREATE INDEX "Commitment_projectId_idx" ON "Commitment"("projectId");

-- CreateIndex
CREATE INDEX "Commitment_vendorId_idx" ON "Commitment"("vendorId");

-- CreateIndex
CREATE INDEX "Commitment_createdByUserId_idx" ON "Commitment"("createdByUserId");

-- CreateIndex
CREATE INDEX "ExpectedInvoice_orgId_idx" ON "ExpectedInvoice"("orgId");

-- CreateIndex
CREATE INDEX "ExpectedInvoice_commitmentId_idx" ON "ExpectedInvoice"("commitmentId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorInvoiceRequest_tokenHash_key" ON "VendorInvoiceRequest"("tokenHash");

-- CreateIndex
CREATE INDEX "VendorInvoiceRequest_orgId_idx" ON "VendorInvoiceRequest"("orgId");

-- CreateIndex
CREATE INDEX "VendorInvoiceRequest_commitmentId_idx" ON "VendorInvoiceRequest"("commitmentId");

-- CreateIndex
CREATE INDEX "VendorInvoiceUpload_orgId_idx" ON "VendorInvoiceUpload"("orgId");

-- CreateIndex
CREATE INDEX "VendorInvoiceUpload_requestId_idx" ON "VendorInvoiceUpload"("requestId");

-- CreateIndex
CREATE INDEX "ProjectUpdate_orgId_idx" ON "ProjectUpdate"("orgId");

-- CreateIndex
CREATE INDEX "ProjectUpdate_projectId_createdAt_idx" ON "ProjectUpdate"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Document_orgId_idx" ON "Document"("orgId");

-- CreateIndex
CREATE INDEX "Document_projectId_idx" ON "Document"("projectId");

-- CreateIndex
CREATE INDEX "Permit_orgId_idx" ON "Permit"("orgId");

-- CreateIndex
CREATE INDEX "Permit_projectId_idx" ON "Permit"("projectId");

-- CreateIndex
CREATE INDEX "Permit_expiresAt_idx" ON "Permit"("expiresAt");

-- CreateIndex
CREATE INDEX "Abatement_orgId_idx" ON "Abatement"("orgId");

-- CreateIndex
CREATE INDEX "Abatement_projectId_idx" ON "Abatement"("projectId");

-- CreateIndex
CREATE INDEX "Abatement_termEnd_idx" ON "Abatement"("termEnd");

-- CreateIndex
CREATE INDEX "PlanSet_orgId_idx" ON "PlanSet"("orgId");

-- CreateIndex
CREATE INDEX "PlanSet_projectId_idx" ON "PlanSet"("projectId");

-- CreateIndex
CREATE INDEX "Inspection_orgId_idx" ON "Inspection"("orgId");

-- CreateIndex
CREATE INDEX "Inspection_projectId_idx" ON "Inspection"("projectId");

-- CreateIndex
CREATE INDEX "Bank_orgId_idx" ON "Bank"("orgId");

-- CreateIndex
CREATE INDEX "Loan_orgId_idx" ON "Loan"("orgId");

-- CreateIndex
CREATE INDEX "Loan_projectId_idx" ON "Loan"("projectId");

-- CreateIndex
CREATE INDEX "Loan_bankId_idx" ON "Loan"("bankId");

-- CreateIndex
CREATE INDEX "LoanBanker_orgId_idx" ON "LoanBanker"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "LoanBanker_loanId_userId_key" ON "LoanBanker"("loanId", "userId");

-- CreateIndex
CREATE INDEX "DrawTemplate_orgId_idx" ON "DrawTemplate"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "DrawTemplate_bankId_name_version_key" ON "DrawTemplate"("bankId", "name", "version");

-- CreateIndex
CREATE INDEX "DrawRequest_orgId_idx" ON "DrawRequest"("orgId");

-- CreateIndex
CREATE INDEX "DrawRequest_projectId_idx" ON "DrawRequest"("projectId");

-- CreateIndex
CREATE INDEX "DrawRequest_loanId_idx" ON "DrawRequest"("loanId");

-- CreateIndex
CREATE INDEX "DrawRequest_status_idx" ON "DrawRequest"("status");

-- CreateIndex
CREATE INDEX "DrawLineItem_orgId_idx" ON "DrawLineItem"("orgId");

-- CreateIndex
CREATE INDEX "DrawLineItem_drawRequestId_idx" ON "DrawLineItem"("drawRequestId");

-- CreateIndex
CREATE INDEX "QuickBooksTxn_orgId_idx" ON "QuickBooksTxn"("orgId");

-- CreateIndex
CREATE INDEX "QuickBooksTxn_qbConnectionId_idx" ON "QuickBooksTxn"("qbConnectionId");

-- CreateIndex
CREATE INDEX "QuickBooksTxn_projectId_idx" ON "QuickBooksTxn"("projectId");

-- CreateIndex
CREATE INDEX "QuickBooksTxn_vendorId_idx" ON "QuickBooksTxn"("vendorId");

-- CreateIndex
CREATE INDEX "QuickBooksTxn_commitmentId_idx" ON "QuickBooksTxn"("commitmentId");

-- CreateIndex
CREATE UNIQUE INDEX "QuickBooksTxn_qbConnectionId_qbEntityType_qbEntityId_key" ON "QuickBooksTxn"("qbConnectionId", "qbEntityType", "qbEntityId");

-- CreateIndex
CREATE INDEX "Notification_orgId_idx" ON "Notification"("orgId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "IntegrationEvent_orgId_idx" ON "IntegrationEvent"("orgId");

-- CreateIndex
CREATE INDEX "IntegrationEvent_qbConnectionId_receivedAt_idx" ON "IntegrationEvent"("qbConnectionId", "receivedAt");

-- CreateIndex
CREATE INDEX "QbdInstruction_orgId_idx" ON "QbdInstruction"("orgId");

-- CreateIndex
CREATE INDEX "QbdInstruction_qbConnectionId_status_idx" ON "QbdInstruction"("qbConnectionId", "status");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaChallenge" ADD CONSTRAINT "MfaChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LLC" ADD CONSTRAINT "LLC_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickBooksConnection" ADD CONSTRAINT "QuickBooksConnection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickBooksConnection" ADD CONSTRAINT "QuickBooksConnection_llcId_fkey" FOREIGN KEY ("llcId") REFERENCES "LLC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_llcId_fkey" FOREIGN KEY ("llcId") REFERENCES "LLC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_qbConnectionId_fkey" FOREIGN KEY ("qbConnectionId") REFERENCES "QuickBooksConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpectedInvoice" ADD CONSTRAINT "ExpectedInvoice_commitmentId_fkey" FOREIGN KEY ("commitmentId") REFERENCES "Commitment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorInvoiceRequest" ADD CONSTRAINT "VendorInvoiceRequest_commitmentId_fkey" FOREIGN KEY ("commitmentId") REFERENCES "Commitment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorInvoiceUpload" ADD CONSTRAINT "VendorInvoiceUpload_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VendorInvoiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUpdate" ADD CONSTRAINT "ProjectUpdate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUpdate" ADD CONSTRAINT "ProjectUpdate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permit" ADD CONSTRAINT "Permit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Abatement" ADD CONSTRAINT "Abatement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanSet" ADD CONSTRAINT "PlanSet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bank" ADD CONSTRAINT "Bank_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanBanker" ADD CONSTRAINT "LoanBanker_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanBanker" ADD CONSTRAINT "LoanBanker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawTemplate" ADD CONSTRAINT "DrawTemplate_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawRequest" ADD CONSTRAINT "DrawRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawRequest" ADD CONSTRAINT "DrawRequest_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawRequest" ADD CONSTRAINT "DrawRequest_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DrawTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawLineItem" ADD CONSTRAINT "DrawLineItem_drawRequestId_fkey" FOREIGN KEY ("drawRequestId") REFERENCES "DrawRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickBooksTxn" ADD CONSTRAINT "QuickBooksTxn_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_qbConnectionId_fkey" FOREIGN KEY ("qbConnectionId") REFERENCES "QuickBooksConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QbdInstruction" ADD CONSTRAINT "QbdInstruction_qbConnectionId_fkey" FOREIGN KEY ("qbConnectionId") REFERENCES "QuickBooksConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

