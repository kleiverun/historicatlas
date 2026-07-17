package com.backend.historytimeline.sources;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SourceService {

    private final JdbcTemplate jdbcTemplate;

    public SourceService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Source> getSources() {
        // ORDER BY id keeps the listing in import order, so the primary
        // dataset stays first when more sources are added (phase 7).
        return jdbcTemplate.query(
                "SELECT name, license, attribution, url FROM data_source ORDER BY id",
                (rs, rowNum) -> new Source(
                        rs.getString("name"),
                        rs.getString("license"),
                        rs.getString("attribution"),
                        rs.getString("url")));
    }
}
