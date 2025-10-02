-- Migration: Add barcode setup tracking to users table
-- This allows one-time barcode setup completion

-- Add barcode_setup_token column to users table
-- This token is set during barcode validation and cleared after successful setup
ALTER TABLE users ADD COLUMN IF NOT EXISTS barcode_setup_token VARCHAR(255);

-- Add barcode_setup_completed column to track if initial setup is done
ALTER TABLE users ADD COLUMN IF NOT EXISTS barcode_setup_completed BOOLEAN DEFAULT FALSE;

-- Add index for faster lookup
CREATE INDEX IF NOT EXISTS idx_users_barcode_setup_token ON users(barcode_setup_token);

-- Update existing users to mark as completed (they used regular registration)
UPDATE users SET barcode_setup_completed = TRUE WHERE barcode_setup_token IS NULL;
