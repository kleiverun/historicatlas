package com.backend.historytimeline.borders;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Date;
import java.time.LocalDate;

@Service
public class BorderService {

    private final JdbcTemplate jdbcTemplate;

    public BorderService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // Three CTEs (Common Table Expressions -- named sub-queries you can
    // chain, each one building on the last):
    //
    // 1. filtered   -- the interval query: which countries were valid on
    //                  this exact date (verified in phase 0 and phase 1).
    // 2. cleaned    -- ST_CoverageClean fixes real overlaps between
    //                  neighboring countries (e.g. the Baarle enclaves --
    //                  see phase 0's findings). Requires PostGIS 3.6 +
    //                  GEOS 3.14+, confirmed present on this database.
    // 3. simplified -- ST_CoverageSimplify reduces point count for the
    //                  requested zoom level, without reopening the gaps
    //                  ST_CoverageClean just closed.
    //
    // The final SELECT assembles the whole FeatureCollection as one JSON
    // value inside PostgreSQL, so Java never touches the geometry --
    // it only forwards the resulting string.
    private static final String QUERY = """
            WITH filtered AS (
                SELECT tv.id, tv.geom, p.name, tv.precision, tv.valid_from, tv.valid_to,
                       ds.name AS source_name
                FROM territory_version tv
                JOIN polity p ON p.id = tv.polity_id
                JOIN data_source ds ON ds.id = tv.source_id
                WHERE tv.valid_from <= ? AND (tv.valid_to IS NULL OR tv.valid_to > ?)
            ),
            cleaned AS (
                SELECT id, ST_CoverageClean(geom) OVER () AS geom
                FROM filtered
            ),
            simplified AS (
                SELECT id, ST_CoverageSimplify(geom, ?) OVER () AS geom
                FROM cleaned
            )
            -- ST_Multi: the coverage functions demote single-part
            -- MultiPolygons to plain Polygons; force MultiPolygon so the
            -- GeoJSON geometry type is stable for API consumers.
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(json_agg(json_build_object(
                    'type', 'Feature',
                    'geometry', ST_AsGeoJSON(ST_Multi(s.geom))::json,
                    'properties', json_build_object(
                        'name', f.name,
                        'precision', f.precision,
                        'validFrom', f.valid_from,
                        'validTo', f.valid_to,
                        'source', f.source_name
                    )
                )), '[]'::json)
            )::text
            FROM simplified s
            JOIN filtered f ON f.id = s.id
            """;

    public String getBordersAsGeoJson(LocalDate date, int zoom) {
        Date sqlDate = Date.valueOf(date);
        double tolerance = toleranceForZoom(zoom);

        return jdbcTemplate.queryForObject(QUERY, String.class, sqlDate, sqlDate, tolerance);
    }

    // Package-private (no modifier) instead of private so the unit test
    // in the same package can call it directly.
    static double toleranceForZoom(int zoom) {
        // Each zoom level roughly doubles the map scale, so simplification
        // tolerance halves accordingly. Degrees, not meters -- the
        // geometries are stored in WGS84 (EPSG:4326). This is a first-guess
        // heuristic, not a tuned formula -- adjust by eye once the frontend
        // is actually rendering tiles in phase 3.
        return 1.0 / Math.pow(2, zoom);
    }
}