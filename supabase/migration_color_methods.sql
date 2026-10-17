-- Run this in the Supabase SQL editor (once).
-- Stores the colour computed by every method for each can, so the admin can
-- switch sort methods without reprocessing photos.
ALTER TABLE cans ADD COLUMN IF NOT EXISTS color_methods jsonb;
