package com.backend.historytimeline;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Starts a throwaway PostGIS database in Docker for integration tests.
 *
 * @ServiceConnection wires the container's JDBC URL/username/password
 * into Spring automatically, overriding application.properties -- no
 * @DynamicPropertySource boilerplate needed. Flyway then runs the real
 * migration against it, so the tests exercise the actual schema.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    PostgreSQLContainer<?> postgisContainer() {
        // Same image as production (see PROJECT.md, Risiko 1): the alpine
        // 3.6 variant ships GEOS 3.14, which ST_CoverageClean requires.
        // asCompatibleSubstituteFor tells Testcontainers this non-standard
        // image behaves like the official postgres image.
        return new PostgreSQLContainer<>(
                DockerImageName.parse("postgis/postgis:17-3.6-alpine")
                        .asCompatibleSubstituteFor("postgres"));
    }
}
