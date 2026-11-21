-- 021: push notifications (N1). One phone per worker (D44), so the phone's push address lives on the worker row.
-- push_token: the Firebase Cloud Messaging registration token of the worker's signed-in phone (NULL = none).
-- push_lang:  the phone's language, so the server writes the notification in it.
ALTER TABLE workers
    ADD COLUMN push_token    TEXT,
    ADD COLUMN push_lang     TEXT NOT NULL DEFAULT 'en' CHECK (push_lang IN ('en', 'hi')),
    ADD COLUMN push_token_at TIMESTAMPTZ;
