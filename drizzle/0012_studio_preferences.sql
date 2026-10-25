CREATE TABLE IF NOT EXISTS studio_preferences (
 user_id TEXT PRIMARY KEY NOT NULL,
 audience TEXT NOT NULL DEFAULT 'Unisex' CHECK (audience IN ('Menswear','Womenswear','Unisex')),
 updated_at TEXT NOT NULL
);
