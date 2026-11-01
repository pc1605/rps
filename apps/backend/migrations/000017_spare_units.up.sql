-- 017 (U3): spare stock. Cancelling a batch after cutting keeps its cut and stitched mats as
-- 'spare' units (they stay on the cancelled batch until reused on a new batch of the same car item).
ALTER TYPE unit_status ADD VALUE IF NOT EXISTS 'spare';
