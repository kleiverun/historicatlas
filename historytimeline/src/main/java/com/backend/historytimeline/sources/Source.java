package com.backend.historytimeline.sources;

// One row of the data_source table, serialized as-is by Jackson. The
// attribution string is the academic citation the CC BY-NC-SA license
// requires us to display.
public record Source(String name, String license, String attribution, String url) {
}
