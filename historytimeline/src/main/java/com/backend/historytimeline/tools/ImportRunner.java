package com.backend.historytimeline.tools;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * Standalone import tool. Moves data from staging.cshapes_raw (raw data
 * loaded by ogr2ogr) into the three normalized tables: data_source,
 * polity, territory_version.
 *
 * Run manually, once — not part of the web application. The whole import
 * runs in a single transaction: if anything fails partway through,
 * EVERYTHING is rolled back, leaving the database exactly as it was
 * before the attempt. No half-finished tables to clean up.
 */
public class ImportRunner {

    // Same connection details as application.properties.
    private static final String URL = "jdbc:postgresql://localhost:5433/postgres";
    private static final String USER = "postgres";
    private static final String PASSWORD = "atlas";

    public static void main(String[] args) {

        // try-with-resources: the Connection is closed automatically when
        // the block ends, even if something throws an exception along the
        // way. Without this we'd need a separate finally block just to
        // close the connection.
        try (Connection connection = DriverManager.getConnection(URL, USER, PASSWORD)) {

            // Turn off auto-commit. Now WE decide when changes are
            // actually saved — with connection.commit() at the very end.
            connection.setAutoCommit(false);

            if (hasExistingData(connection)) {
                System.err.println("territory_version already has data. "
                        + "Truncate the tables manually before re-running the import "
                        + "(see the instructions that came with this file).");
                System.exit(1);
            }

            long sourceId = insertDataSource(connection);
            int polityCount = insertPolities(connection);
            int territoryCount = insertTerritoryVersions(connection, sourceId);

            connection.commit();

            System.out.println("Import complete.");
            System.out.println("  data_source: 1 row (id=" + sourceId + ")");
            System.out.println("  polity: " + polityCount + " rows");
            System.out.println("  territory_version: " + territoryCount + " rows");

        } catch (SQLException e) {
            // Note: since commit() was never reached, everything is
            // already rolled back by the database itself once the
            // connection closes.
            System.err.println("Import failed, nothing was saved: " + e.getMessage());
            System.exit(1);
        }
    }

    private static boolean hasExistingData(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(
                     "SELECT COUNT(*) FROM territory_version")) {
            resultSet.next();
            return resultSet.getInt(1) > 0;
        }
    }

    private static long insertDataSource(Connection connection) throws SQLException {
        String sql = """
                INSERT INTO data_source (name, license, attribution, url)
                VALUES (?, ?, ?, ?)
                """;

        // RETURN_GENERATED_KEYS asks PostgreSQL to send back the id it
        // just generated for the new row (from the BIGSERIAL column).
        try (PreparedStatement statement = connection.prepareStatement(
                sql, Statement.RETURN_GENERATED_KEYS)) {
            statement.setString(1, "CShapes 2.0");
            statement.setString(2, "CC BY-NC-SA 4.0");
            statement.setString(3, "Schvitz, Guy, Seraina Ruegger, Luc Girardin, "
                    + "Lars-Erik Cederman, Nils Weidmann, and Kristian Skrede Gleditsch. 2022. "
                    + "\"Mapping The International System, 1886-2019: The CShapes 2.0 Dataset.\" "
                    + "Journal of Conflict Resolution 66(1): 144-61.");
            statement.setString(4, "https://icr.ethz.ch/data/cshapes/");
            statement.executeUpdate();

            try (ResultSet keys = statement.getGeneratedKeys()) {
                keys.next();
                return keys.getLong(1);
            }
        }
    }

    private static int insertPolities(Connection connection) throws SQLException {
        // DISTINCT ON is PostgreSQL-specific: keep only one row per
        // gwcode. ORDER BY ... gwedate DESC makes sure the row with the
        // most recent name wins, in case a country's name changed at
        // some point within the period the dataset covers.
        String sql = """
                INSERT INTO polity (name, gw_code)
                SELECT DISTINCT ON (gwcode) cntry_name, gwcode::integer
                FROM staging.cshapes_raw
                ORDER BY gwcode, gwedate DESC
                """;

        try (Statement statement = connection.createStatement()) {
            return statement.executeUpdate(sql);
        }
    }

    private static int insertTerritoryVersions(Connection connection, long sourceId)
            throws SQLException {
        // ST_MakeValid fixes self-overlapping polygons WITHIN a single
        // geometry. That's a different problem from the coverage issues
        // found in phase 0 (which were about NEIGHBORING countries not
        // lining up) — those are handled separately, later, when the
        // simplification levels are computed.
        //
        // gwedate + 1 day: gwedate is inclusive in CShapes (last valid
        // day), but valid_to in our model is exclusive. Without +1 day,
        // every country would disappear from the map one day too early
        // at each border change — verified against Poland's rows in
        // phase 0. (r.gwedate + INTERVAL '1 day') produces a timestamp,
        // hence the final ::date cast to match the column type.
        String sql = """
                INSERT INTO territory_version
                    (polity_id, geom, valid_from, valid_to, precision, source_id)
                SELECT p.id,
                       ST_MakeValid(r.geom),
                       r.gwsdate,
                       (r.gwedate + INTERVAL '1 day')::date,
                       NULL,
                       ?
                FROM staging.cshapes_raw r
                JOIN polity p ON p.gw_code = r.gwcode::integer
                """;

        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setLong(1, sourceId);
            return statement.executeUpdate();
        }
    }
}