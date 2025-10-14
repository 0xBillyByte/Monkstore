-- init_db.sql  –  Datenbankstruktur + Seed-Daten
-- Ausfuehren im Container z. B.:
--   docker compose exec db psql -U admin -d monkeymint -f /path/to/init_db.sql

------------------------------------------------------------
-- Basis: UUID-Generator aktivieren
------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


------------------------------------------------------------
-- Tabellen loeschen, falls vorhanden (Test-Runs)
------------------------------------------------------------
DROP TABLE IF EXISTS shoppingcart  CASCADE;
DROP TABLE IF EXISTS monkey_traits CASCADE;
DROP TABLE IF EXISTS monkeys       CASCADE;
DROP TABLE IF EXISTS profile       CASCADE;

------------------------------------------------------------
-- 1) profile  –  Benutzerkonten
------------------------------------------------------------
CREATE TABLE profile (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username   TEXT NOT NULL UNIQUE,
  email      TEXT NOT NULL UNIQUE,
  password   TEXT NOT NULL,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

------------------------------------------------------------
-- 2) monkeys  –  Produktkatalog
------------------------------------------------------------
CREATE TABLE monkeys (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  image_url    TEXT,
  rarity       TEXT,
  price        INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

------------------------------------------------------------
-- 3) monkey_traits  –  Eigenschaften pro Monkey
------------------------------------------------------------
CREATE TABLE monkey_traits (
  monkey_id   TEXT REFERENCES monkeys(id) ON DELETE CASCADE,
  background  TEXT NOT NULL,
  fur         TEXT NOT NULL,
  headgear    TEXT NOT NULL,
  prop        TEXT NOT NULL,
  PRIMARY KEY (monkey_id)
);

------------------------------------------------------------
-- 4) shoppingcart  –  Warenkorb-Eintraege
------------------------------------------------------------
CREATE TABLE shoppingcart (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID REFERENCES profile(id)  ON DELETE CASCADE,
  monkey_id   TEXT REFERENCES monkeys(id)  ON DELETE CASCADE,
  quantity    INTEGER NOT NULL DEFAULT 1,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(profile_id, monkey_id)
);
