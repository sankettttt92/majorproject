-- schema.sql
-- Run this by hand against your database before starting the app:
--   psql -U disaster_admin -d disaster_response -h localhost -f schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
    CREATE TYPE incidentseverity AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE incidentstatus AS ENUM ('PENDING', 'VERIFIED', 'DISPATCHED', 'RESOLVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id          VARCHAR(64) UNIQUE NOT NULL,
    phone_number         VARCHAR(20),
    full_name            VARCHAR(120),
    registered_device_id VARCHAR(128),
    is_verified          BOOLEAN NOT NULL DEFAULT FALSE,
    last_known_lat       FLOAT,
    last_known_lon       FLOAT,
    last_seen_at         TIMESTAMP,
    created_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_users_external_id ON users (external_id);

CREATE TABLE IF NOT EXISTS incidents (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id          VARCHAR(64) NOT NULL,
    device_id        VARCHAR(128),

    latitude         FLOAT NOT NULL,
    longitude        FLOAT NOT NULL,
    accuracy_meters  FLOAT,
    address          TEXT,
    zone             VARCHAR(128),

    incident_type    VARCHAR(64) NOT NULL DEFAULT 'SOS',
    severity         incidentseverity NOT NULL DEFAULT 'MODERATE',
    status           incidentstatus NOT NULL DEFAULT 'PENDING',
    detail           TEXT,

    trust_score      INTEGER NOT NULL DEFAULT 0,
    risk_score       INTEGER NOT NULL DEFAULT 0,
    priority         INTEGER NOT NULL DEFAULT 0,

    created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_incidents_user_id ON incidents (user_id);
CREATE INDEX IF NOT EXISTS ix_incidents_created_at ON incidents (created_at);
CREATE TABLE media_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_type VARCHAR(20) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER,
    mime_type VARCHAR(50),
    uploaded_by VARCHAR(255),
    uploaded_at TIMESTAMP DEFAULT now(),
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,

    CONSTRAINT chk_media_type CHECK (media_type IN ('photo', 'audio'))
);

CREATE INDEX idx_media_uploads_uploaded_at ON media_uploads(uploaded_at);
CREATE INDEX idx_media_uploads_incident_id ON media_uploads(incident_id);