package com.backend.historytimeline.borders;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure unit tests for the zoom -> simplification tolerance mapping.
 * No Spring, no database -- just the arithmetic.
 */
class BorderServiceToleranceTest {

    @ParameterizedTest
    @CsvSource({
            // zoom, expected tolerance (degrees): halves per zoom level
            "0,  1.0",
            "1,  0.5",
            "2,  0.25",
            "5,  0.03125",
            "10, 0.0009765625",
            "18, 0.000003814697265625",
    })
    void toleranceHalvesForEachZoomLevel(int zoom, double expected) {
        assertThat(BorderService.toleranceForZoom(zoom)).isEqualTo(expected);
    }

    @Test
    void toleranceIsStrictlyDecreasingAcrossTheAllowedZoomRange() {
        // The controller clamps zoom to 0..18; over that whole range,
        // more zoom must always mean less simplification.
        for (int zoom = 1; zoom <= 18; zoom++) {
            assertThat(BorderService.toleranceForZoom(zoom))
                    .as("tolerance at zoom %d vs zoom %d", zoom, zoom - 1)
                    .isLessThan(BorderService.toleranceForZoom(zoom - 1));
        }
    }

    @Test
    void toleranceIsAlwaysPositive() {
        // Zero (or negative) tolerance would make ST_CoverageSimplify a
        // no-op at best -- every zoom level must simplify by SOMETHING.
        for (int zoom = 0; zoom <= 18; zoom++) {
            assertThat(BorderService.toleranceForZoom(zoom)).isPositive();
        }
    }
}
