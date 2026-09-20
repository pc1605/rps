ALTER TABLE batches
  ADD COLUMN cut_qty         INT  NOT NULL DEFAULT 0,          -- cumulative pieces reported cut
  ADD COLUMN parent_batch_id UUID REFERENCES batches(id),      -- set on remainder batches (split)
  ADD COLUMN short_reason    TEXT;                             -- set by 'reduce'
-- batches already past cutting count as fully cut
UPDATE batches SET cut_qty = quantity WHERE current_phase <> 'cutting';