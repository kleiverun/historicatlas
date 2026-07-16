CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE data_source (
                             id          BIGSERIAL PRIMARY KEY,
                             name        VARCHAR(200) NOT NULL,
                             license     VARCHAR(100) NOT NULL,
                             attribution TEXT NOT NULL,
                             url         VARCHAR(500)
);

CREATE TABLE polity (
                        id          BIGSERIAL PRIMARY KEY,
                        name        VARCHAR(200) NOT NULL,
                        gw_code     INTEGER,
                        wikidata_id VARCHAR(20)
);

CREATE TABLE territory_version (
                                   id         BIGSERIAL PRIMARY KEY,
                                   polity_id  BIGINT NOT NULL REFERENCES polity(id),
                                   geom       GEOMETRY(MultiPolygon, 4326) NOT NULL,
                                   valid_from DATE NOT NULL,
                                   valid_to   DATE,
                                   precision  SMALLINT,
                                   source_id  BIGINT NOT NULL REFERENCES data_source(id)
);

CREATE INDEX idx_tv_validity ON territory_version (valid_from, valid_to);
CREATE INDEX idx_tv_geom ON territory_version USING GIST (geom);