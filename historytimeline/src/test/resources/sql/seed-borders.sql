-- Five test countries as adjacent unit squares (a valid coverage: they
-- share edges but never overlap, which ST_CoverageClean/Simplify expect).
-- Validity windows are chosen so a query for 1910-01-01 must return
-- exactly three of them, including both boundary cases:
--
--   Alpha    1900-01-01 .. 1920-01-01  -> valid in 1910
--   Beta     1905-06-15 .. NULL (open) -> valid in 1910
--   Gamma    1910-01-01 .. 1930-01-01  -> starts ON the date; valid_from
--                                         is inclusive, so INCLUDED
--   Delta    1890-01-01 .. 1910-01-01  -> ends ON the date; valid_to is
--                                         exclusive, so EXCLUDED
--   Epsilon  1920-01-01 .. 1940-01-01  -> later era, excluded

INSERT INTO data_source (name, license, attribution, url)
VALUES ('Test fixture', 'CC0', 'synthetic test data', NULL);

INSERT INTO polity (name, gw_code) VALUES
    ('Alpha',   901),
    ('Beta',    902),
    ('Gamma',   903),
    ('Delta',   904),
    ('Epsilon', 905);

INSERT INTO territory_version (polity_id, geom, valid_from, valid_to, precision, source_id)
SELECT p.id,
       ST_Multi(ST_GeomFromText(v.wkt, 4326)),
       v.valid_from::date,
       v.valid_to::date,
       1,
       (SELECT id FROM data_source WHERE name = 'Test fixture')
FROM (VALUES
    ('Alpha',   'POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))', '1900-01-01', '1920-01-01'),
    ('Beta',    'POLYGON((1 0, 2 0, 2 1, 1 1, 1 0))', '1905-06-15', NULL),
    ('Gamma',   'POLYGON((2 0, 3 0, 3 1, 2 1, 2 0))', '1910-01-01', '1930-01-01'),
    ('Delta',   'POLYGON((3 0, 4 0, 4 1, 3 1, 3 0))', '1890-01-01', '1910-01-01'),
    ('Epsilon', 'POLYGON((4 0, 5 0, 5 1, 4 1, 4 0))', '1920-01-01', '1940-01-01')
) AS v(name, wkt, valid_from, valid_to)
JOIN polity p ON p.name = v.name;
