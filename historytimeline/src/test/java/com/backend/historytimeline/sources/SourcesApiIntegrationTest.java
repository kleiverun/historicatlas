package com.backend.historytimeline.sources;

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

import static org.assertj.core.api.Assertions.assertThat;

/**
 * GET /api/v1/sources against a real PostGIS started by Testcontainers.
 * The endpoint exists to satisfy the CC BY-NC-SA attribution requirement,
 * so the assertions check that every field the license cares about
 * (name, license, attribution) comes through.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import(TestcontainersConfiguration.class)
@Sql(scripts = "/sql/seed-borders.sql")
@Sql(scripts = "/sql/cleanup-borders.sql", executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
class SourcesApiIntegrationTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void listsEverySourceWithLicenseAndAttribution() throws Exception {
        ResponseEntity<String> response =
                restTemplate.getForEntity("/api/v1/sources", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);

        JsonNode body = objectMapper.readTree(response.getBody());
        assertThat(body.isArray()).isTrue();
        assertThat(body).hasSize(1);

        JsonNode source = body.get(0);
        assertThat(source.get("name").asText()).isEqualTo("Test fixture");
        assertThat(source.get("license").asText()).isEqualTo("CC0");
        assertThat(source.get("attribution").asText()).isEqualTo("synthetic test data");
        // url is nullable in the schema and null in the fixture.
        assertThat(source.get("url").isNull()).isTrue();
    }

    @Test
    void responseIsCacheableForADay() {
        ResponseEntity<String> response =
                restTemplate.getForEntity("/api/v1/sources", String.class);

        assertThat(response.getHeaders().getCacheControl())
                .contains("max-age=86400")
                .contains("public");
    }
}
