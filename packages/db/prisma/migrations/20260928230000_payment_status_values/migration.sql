-- Own migration: Postgres cannot use a new enum value in the transaction that adds it.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'awaiting_proof';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'cancelled';
