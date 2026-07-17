package com.backend.historytimeline.sources;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.concurrent.TimeUnit;

// Exposes the data_source table: the CC BY-NC-SA license requires the
// attribution to be visible, and the frontend's Sources page reads it
// from here instead of hardcoding a copy that could drift.
@RestController
public class SourceController {

    private final SourceService sourceService;

    public SourceController(SourceService sourceService) {
        this.sourceService = sourceService;
    }

    @GetMapping(value = "/api/v1/sources", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<Source>> getSources() {
        // Not immutable like /borders: a new import can add a source,
        // so let caches revalidate daily.
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic())
                .body(sourceService.getSources());
    }
}
