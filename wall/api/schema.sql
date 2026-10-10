-- Latent Wall accounts and sites. An account is an email. A site has a stable id and, once published, a label:
-- the first word of its address (label.latentstudios.art). Sessions and sign-in links are kept as hashes only.
DROP TABLE IF EXISTS sites;
CREATE TABLE IF NOT EXISTS accounts (email TEXT PRIMARY KEY, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS logins (hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires INTEGER NOT NULL, made TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sites (id TEXT PRIMARY KEY, email TEXT NOT NULL, label TEXT UNIQUE, document TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, updated TEXT NOT NULL, published TEXT);
CREATE INDEX IF NOT EXISTS sites_by_email ON sites (email);
CREATE TABLE IF NOT EXISTS invites (hash TEXT PRIMARY KEY, name TEXT NOT NULL, made TEXT NOT NULL, used_by TEXT);
