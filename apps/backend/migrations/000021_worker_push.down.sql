ALTER TABLE workers
    DROP COLUMN IF EXISTS push_token_at,
    DROP COLUMN IF EXISTS push_lang,
    DROP COLUMN IF EXISTS push_token;
