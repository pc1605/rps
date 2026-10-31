-- Re-adding car_models_brand_id_name_key will fail if multiple product lines exist for the same car model.
-- Only re-add if duplicates by (brand_id, name) do not exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM car_models GROUP BY brand_id, name HAVING COUNT(*) > 1
  ) THEN
    ALTER TABLE car_models ADD CONSTRAINT car_models_brand_id_name_key UNIQUE (brand_id, name);
  ELSE
    RAISE NOTICE 'Skipping re-addition of car_models_brand_id_name_key: duplicate (brand_id, name) records exist across product lines';
  END IF;
END $$;
