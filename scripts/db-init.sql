-- Runs once, when the compose Postgres volume is first created.
-- The e2e tests use this database (TEST_DATABASE_URL); the app uses `hushmate`.
CREATE DATABASE hushmate_test;
