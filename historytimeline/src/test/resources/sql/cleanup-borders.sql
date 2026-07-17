-- Wipe fixture data so every test method starts from an empty schema.
-- Order matters: territory_version references both other tables.
DELETE FROM territory_version;
DELETE FROM polity;
DELETE FROM data_source;
