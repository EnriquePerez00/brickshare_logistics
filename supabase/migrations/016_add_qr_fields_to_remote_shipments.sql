-- ============================================================
-- Migration 016: Add QR fields to remote shipments table
-- 
-- PURPOSE:
-- Add fields to support both delivery and pickup QR codes
-- in the Brickshare (remote) shipments table
--
-- Changes:
-- - delivery_qr_code: QR code for PUDO dropoff
-- - pickup_qr_code: QR code for customer delivery
-- - delivery_validated_at: Timestamp when dropoff is validated
-- - pickup_validated_at: Timestamp when delivery to customer is validated
-- ============================================================

-- Note: This migration is for documentation purposes.
-- The actual fields should exist in the Brickshare remote database.
-- If they don't exist, execute this on the remote Brickshare DB:

/*
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS delivery_qr_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS pickup_qr_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS delivery_validated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS pickup_validated_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_shipments_delivery_qr_code 
ON shipments(delivery_qr_code) 
WHERE delivery_qr_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shipments_pickup_qr_code 
ON shipments(pickup_qr_code) 
WHERE pickup_qr_code IS NOT NULL;

-- Create index for validation queries
CREATE INDEX IF NOT EXISTS idx_shipments_status_delivery_qr 
ON shipments(shipment_status, delivery_qr_code);

CREATE INDEX IF NOT EXISTS idx_shipments_status_pickup_qr 
ON shipments(shipment_status, pickup_qr_code);
*/

-- Verification query to check fields exist:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'shipments' 
-- AND column_name IN ('delivery_qr_code', 'pickup_qr_code', 'delivery_validated_at', 'pickup_validated_at');