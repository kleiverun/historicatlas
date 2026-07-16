package com.backend.historytimeline.borders;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.concurrent.TimeUnit;

// @Validated at the class level is required for @Min/@Max on individual
// @RequestParam values to actually be enforced -- without it, the
// annotations are silently ignored.
@RestController
@Validated
public class BorderController {

    private final BorderService borderService;

    public BorderController(BorderService borderService) {
        this.borderService = borderService;
    }

    @GetMapping(value = "/api/v1/borders", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> getBorders(
            // Spring converts "1910-01-01" style query strings to
            // LocalDate automatically -- no extra configuration needed.
            @RequestParam LocalDate date,
            // Clamped 0-18 here so nobody can request unbounded detail
            // and load down the database -- see project notes on this.
            @RequestParam(defaultValue = "5") @Min(0) @Max(18) int zoom) {

        String geoJson = borderService.getBordersAsGeoJson(date, zoom);

        // The data never changes -- 1910 looks the same forever -- so
        // browsers and CDNs can cache this response essentially forever.
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable())
                .body(geoJson);
    }
}