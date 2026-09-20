ALTER TABLE car_models ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
-- RPS-generated barcodes: 386 + 8-digit sequence + Luhn check digit (12 digits, scanner-safe)
CREATE SEQUENCE car_barcode_seq START 10000001;