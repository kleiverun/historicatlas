package com.backend.historytimeline.tools;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Standalone import tool for the CShapes-Europe extension (phase 7).
 * Moves data from staging.cshapes_europe_raw (loaded from
 * CShapes-Europe.geojson, see README) into the same three normalized
 * tables as ImportRunner — no domain model change, second data_source.
 *
 * Differences from the main CShapes 2.0 import:
 *
 * - ADDITIVE: runs against a database that already holds CShapes 2.0.
 *   The guard checks for this source's data_source row, not for an
 *   empty territory_version.
 * - Validity is in whole YEARS (From/To, both inclusive), not dates.
 *   valid_from = Jan 1 of From, valid_to = Jan 1 of To+1 (exclusive).
 * - Clipped to [1816, 1886): CShapes 2.0 owns everything from
 *   1886-01-01, so Europe rows are capped at that date to keep exactly
 *   one source per polity per day. The handful of rows starting before
 *   1816 (the dataset's official start) are clamped up to 1816.
 * - Only Status = 'independent' rows are imported, matching the
 *   state-system scope of the main dataset.
 */
public class ImportEuropeRunner {

    // Same connection details as application.properties.
    private static final String URL = "jdbc:postgresql://localhost:5433/postgres";
    private static final String USER = "postgres";
    private static final String PASSWORD = "atlas";

    private static final String SOURCE_NAME = "CShapes-Europe";

    public static void main(String[] args) {

        try (Connection connection = DriverManager.getConnection(URL, USER, PASSWORD)) {

            connection.setAutoCommit(false);

            if (alreadyImported(connection)) {
                System.err.println(SOURCE_NAME + " is already in data_source. "
                        + "Delete its territory_version and data_source rows manually "
                        + "before re-running the import.");
                System.exit(1);
            }

            long sourceId = insertDataSource(connection);
            int polityCount = insertPolities(connection);
            int territoryCount = insertTerritoryVersions(connection, sourceId);

            connection.commit();

            System.out.println("Import complete.");
            System.out.println("  data_source: 1 row (id=" + sourceId + ")");
            System.out.println("  polity: " + polityCount + " new rows");
            System.out.println("  territory_version: " + territoryCount + " rows");

        } catch (SQLException e) {
            System.err.println("Import failed, nothing was saved: " + e.getMessage());
            System.exit(1);
        }
    }

    private static boolean alreadyImported(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT COUNT(*) FROM data_source WHERE name = ?")) {
            statement.setString(1, SOURCE_NAME);
            try (ResultSet resultSet = statement.executeQuery()) {
                resultSet.next();
                return resultSet.getInt(1) > 0;
            }
        }
    }

    private static long insertDataSource(Connection connection) throws SQLException {
        String sql = """
                INSERT INTO data_source (name, license, attribution, url)
                VALUES (?, ?, ?, ?)
                """;

        try (PreparedStatement statement = connection.prepareStatement(
                sql, Statement.RETURN_GENERATED_KEYS)) {
            statement.setString(1, SOURCE_NAME);
            statement.setString(2, "CC BY-NC-SA 4.0");
            statement.setString(3, "Cederman, Lars-Erik, Luc Girardin, "
                    + "Carl Müller-Crepon, and Yannick Pengl. 2025. "
                    + "\"Nationalism and the Transformation of the State: Border Change "
                    + "and Political Violence in the Modern World.\" "
                    + "Cambridge University Press.");
            statement.setString(4, "https://icr.ethz.ch/data/cshapes/");
            statement.executeUpdate();

            try (ResultSet keys = statement.getGeneratedKeys()) {
                keys.next();
                return keys.getLong(1);
            }
        }
    }

    private static int insertPolities(Connection connection) throws SQLException {
        // Only polities CShapes 2.0 didn't already create — matched on
        // the shared Gleditsch & Ward code (Id in this dataset). The
        // pre-unification microstates (Bavaria, Parma, ...) are new;
        // Russia, Sweden etc. already exist and are reused as-is.
        String sql = """
                INSERT INTO polity (name, gw_code)
                SELECT DISTINCT ON (r.id) r.name, r.id
                FROM staging.cshapes_europe_raw r
                WHERE r.status = 'independent'
                  AND r.from_year < 1886
                  AND NOT EXISTS (SELECT 1 FROM polity p WHERE p.gw_code = r.id)
                ORDER BY r.id, r.to_year DESC
                """;

        try (Statement statement = connection.createStatement()) {
            return statement.executeUpdate(sql);
        }
    }

    private static int insertTerritoryVersions(Connection connection, long sourceId)
            throws SQLException {
        // ST_CollectionExtract(..., 3) after ST_MakeValid: MakeValid can
        // return a GeometryCollection with stray points/lines; keep only
        // the polygonal parts. ST_Multi then matches the MultiPolygon
        // column type (the GeoJSON mixes Polygon and MultiPolygon).
        String sql = """
                INSERT INTO territory_version
                    (polity_id, geom, valid_from, valid_to, precision, source_id)
                SELECT p.id,
                       ST_Multi(ST_CollectionExtract(ST_MakeValid(r.geom), 3)),
                       make_date(GREATEST(r.from_year, 1816), 1, 1),
                       make_date(LEAST(r.to_year + 1, 1886), 1, 1),
                       NULL,
                       ?
                FROM staging.cshapes_europe_raw r
                JOIN polity p ON p.gw_code = r.id
                WHERE r.status = 'independent'
                  AND r.from_year < 1886
                """;

        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, sourceId);
            return statement.executeUpdate();
        }
    }
}
