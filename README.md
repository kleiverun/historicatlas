# Historical Atlas

**Europe's borders, dragged through time.**

A web application that shows how national borders change over time. Drag the
timeline slider and the map redraws the borders as they were — from 1816 to
2019, backed by [CShapes 2.0](https://icr.ethz.ch/data/cshapes/) (ETH Zürich,
global 1886–2019) and [CShapes-Europe](https://icr.ethz.ch/data/cshapes/)
(Cederman et al., European states 1816–1885).

<!-- TODO: screenshot / GIF of the slider in action goes here -->

## How it works

```
frontend/index.html          historytimeline/ (Spring Boot)        PostgreSQL + PostGIS
  MapLibre GL JS   ──fetch──►  GET /api/v1/borders?date=&zoom=  ──►  interval query
  slider + globe   ◄─GeoJSON─  ST_AsGeoJSON, cached immutable   ◄──  ST_CoverageClean/Simplify
```

- **Temporal data model** — every territory is stored as one row per period of
  stable borders (`valid_from` / `valid_to`, exclusive end). A country that
  did not exist has no row: Poland simply has nothing before 1918-11-11.
  The whole app rests on one query:

  ```sql
  SELECT p.name, tv.geom
  FROM territory_version tv
  JOIN polity p ON p.id = tv.polity_id
  WHERE tv.valid_from <= :date
    AND (tv.valid_to IS NULL OR tv.valid_to > :date);
  ```

- **The polygons are the map.** There is no third-party basemap and no API
  key. Overlaying 1886 borders on modern coastlines and highways would be
  misleading anyway — the union of all territories *is* the landmass, and the
  background is simply ocean color.

- **Immutable data, aggressive caching.** 1910 never changes, so every API
  response is served with `Cache-Control: public, max-age=31536000, immutable`.

- **Topology-safe simplification.** Countries share borders, so simplifying
  each polygon independently creates gaps and overlaps. Geometries go through
  `ST_CoverageClean` + `ST_CoverageSimplify` (PostGIS 3.6, GEOS 3.14+), which
  simplify the shared edges of the whole coverage together.

## Stack

| Layer | Choice |
|---|---|
| Database | PostgreSQL 17 + PostGIS 3.6 (`postgis/postgis:17-3.6-alpine`, Docker) |
| Backend | Java, Spring Boot, Flyway, REST returning GeoJSON |
| Frontend | MapLibre GL JS via CDN — a single `index.html`, no framework, no build step |
| Data | CShapes 2.0 (ETH Zürich), imported via a standalone JDBC tool |

## Running locally

**1. Start the database** (port 5433 — 5432 is deliberately avoided, see
`PROJECT.md` §3):

```bash
docker run --name atlas-db -e POSTGRES_PASSWORD=atlas \
  -p 5433:5432 -d postgis/postgis:17-3.6-alpine
```

**2. Load the data.** Download CShapes 2.0 (shapefile, Gleditsch & Ward
coding) from https://icr.ethz.ch/data/cshapes/ into `data/`, then stage it:

```bash
ogr2ogr --config SHAPE_ENCODING ISO-8859-1 \
  -f "PostgreSQL" \
  PG:"host=localhost port=5433 dbname=postgres user=postgres password=atlas" \
  data/CShapes-2.0.shp \
  -nln cshapes_raw -nlt MULTIPOLYGON -t_srs EPSG:4326 \
  -lco GEOMETRY_NAME=geom -lco FID=id -overwrite
```

**2b. (Optional) Extend Europe back to 1816.** Download
`CShapes-Europe.geojson` from the same page into `data/`, stage it in
the database (the file is small enough to parse in SQL — no GDAL
needed), and run the second importer:

```bash
docker cp data/CShapes-Europe.geojson atlas-db:/tmp/
docker exec atlas-db psql -U postgres -c "
  CREATE SCHEMA IF NOT EXISTS staging;
  CREATE TABLE staging.cshapes_europe_raw AS
  SELECT (feat->'properties'->>'Id')::int     AS id,
         (feat->'properties'->>'Holder')::int AS holder,
         feat->'properties'->>'Name'          AS name,
         feat->'properties'->>'Status'        AS status,
         (feat->'properties'->>'From')::int   AS from_year,
         (feat->'properties'->>'To')::int     AS to_year,
         ST_SetSRID(ST_GeomFromGeoJSON(feat->>'geometry'), 4326) AS geom
  FROM (SELECT jsonb_array_elements(
          pg_read_file('/tmp/CShapes-Europe.geojson')::jsonb->'features') AS feat) f;"
cd historytimeline && ./mvnw -q compile exec:java \
  -Dexec.mainClass=com.backend.historytimeline.tools.ImportEuropeRunner
```

`ImportEuropeRunner` clips the rows to 1816–1885 (CShapes 2.0 owns
1886 onwards) and reuses existing polities via the shared Gleditsch &
Ward codes — see the class comment for details.

**3. Run the backend** — Flyway creates the schema on startup, and
`ImportRunner` moves the staged rows into the normalized model:

```bash
cd historytimeline
./mvnw spring-boot:run
```

**4. Open the frontend.** Serve `frontend/` with any static file server
(e.g. `python -m http.server` from the `frontend/` directory) and open
`index.html`. Drag the slider.

Verify the API directly:

```
GET http://localhost:8080/api/v1/borders?date=1910-01-01&zoom=5
```

## Status

Phase 1 of 6 complete: schema, import (710 territory versions), and data
verification against two independent years (151 polities in 1910, 169 in
1925 — with Poland present only in the latter). The border endpoint and the
MapLibre frontend work locally; next up is public deployment.

The full decision log — data source evaluation, temporal modeling, why
Alpine over Debian for the PostGIS image, risk analysis — lives in
[`PROJECT.md`](PROJECT.md) (in Norwegian).

## Data source and license

Border data: **CShapes 2.0** by ETH Zürich, licensed
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)
(non-commercial use only). Borders are rendered as coded in the source
dataset, without editorial changes. See [`DATA_SOURCES.md`](DATA_SOURCES.md)
for the full citation.

> Schvitz, Guy, Seraina Rüegger, Luc Girardin, Lars-Erik Cederman, Nils
> Weidmann and Kristian Skrede Gleditsch. 2022. "Mapping The International
> System, 1886-2017: The CShapes 2.0 Dataset." *Journal of Conflict
> Resolution* 66(1): 144–61.
