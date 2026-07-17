package com.backend.historytimeline.borders;

import com.backend.historytimeline.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.jdbc.Sql;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * End-to-end test of GET /api/v1/borders against a real PostGIS started
 * by Testcontainers: Flyway migrates the schema, seed-borders.sql loads
 * five synthetic countries, and the assertions verify the interval query
 * semantics (valid_from inclusive, valid_to exclusive) plus parameter
 * validation and error responses.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import(TestcontainersConfiguration.class)
@Sql(scripts = "/sql/seed-borders.sql")
@Sql(scripts = "/sql/cleanup-borders.sql", executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
class BordersApiIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void returnsExactlyTheCountriesValidIn1910() throws Exception {
        ResponseEntity<String> response =
                restTemplate.getForEntity("/api/v1/borders?date=1910-01-01", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        JsonNode body = objectMapper.readTree(response.getBody());
        assertThat(body.get("type").asText()).isEqualTo("FeatureCollection");

        // The interval query must include Gamma (valid_from == queried
        // date, inclusive) and exclude Delta (valid_to == queried date,
        // exclusive) -- the exact off-by-one-day trap the CShapes import
        // compensates for.
        List<String> names = featureNames(body);
        assertThat(names).containsExactlyInAnyOrder("Alpha", "Beta", "Gamma");
    }

    @Test
    void returnsEmptyFeatureCollectionWhenNoCountryMatches() throws Exception {
        ResponseEntity<String> response =
                restTemplate.getForEntity("/api/v1/borders?date=1850-01-01", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        JsonNode body = objectMapper.readTree(response.getBody());
        assertThat(body.get("type").asText()).isEqualTo("FeatureCollection");
        assertThat(body.get("features")).isEmpty();
    }

    @Test
    void featuresCarryGeometryAndSourceProperties() throws Exception {
        ResponseEntity<String> response =
                restTemplate.getForEntity("/api/v1/borders?date=1910-01-01&zoom=10", String.class);

        JsonNode firstFeature = objectMapper.readTree(response.getBody()).get("features").get(0);
        assertThat(firstFeature.get("geometry").get("type").asText()).isEqualTo("MultiPolygon");
        assertThat(firstFeature.get("properties").get("source").asText()).isEqualTo("Test fixture");
    }

    @Test
    void responseIsCacheableForAYear() {
        ResponseEntity<String> response =
                restTemplate.getForEntity("/api/v1/borders?date=1910-01-01", String.class);

        assertThat(response.getHeaders().getCacheControl())
                .contains("max-age=31536000")
                .contains("public")
                .contains("immutable");
    }

    @Test
    void rejectsZoomAboveMaximum() throws Exception {
        assertBadRequest("/api/v1/borders?date=1910-01-01&zoom=19", "zoom");
    }

    @Test
    void rejectsNegativeZoom() throws Exception {
        assertBadRequest("/api/v1/borders?date=1910-01-01&zoom=-1", "zoom");
    }

    @Test
    void rejectsMalformedDate() throws Exception {
        assertBadRequest("/api/v1/borders?date=not-a-date", "date");
    }

    @Test
    void rejectsMissingDate() {
        ResponseEntity<String> response =
                restTemplate.getForEntity("/api/v1/borders", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    private void assertBadRequest(String url, String expectedParamInDetail) throws Exception {
        ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        // The advice returns an RFC 7807 problem detail naming the
        // offending parameter, so API callers can tell what to fix.
        JsonNode body = objectMapper.readTree(response.getBody());
        assertThat(body.get("status").asInt()).isEqualTo(400);
        assertThat(body.get("detail").asText()).contains(expectedParamInDetail);
    }

    private static List<String> featureNames(JsonNode featureCollection) {
        List<String> names = new ArrayList<>();
        featureCollection.get("features").forEach(
                feature -> names.add(feature.get("properties").get("name").asText()));
        return names;
    }
}
