CREATE TABLE metadata (
    version INTEGER NOT NULL
);

CREATE TABLE project_mapping (
    curseforge_project INTEGER NOT NULL,
    modrinth_project TEXT NOT NULL
);

CREATE TABLE file (
    sha1 TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT NOT NULL
);

CREATE TABLE modrinth_version (
    sha1 TEXT NOT NULL,
    project TEXT NOT NULL,
    version TEXT NOT NULL
);

CREATE TABLE curseforge_file (
    sha1 TEXT NOT NULL,
    project INTEGER NOT NULL,
    file INTEGER NOT NULL
);

CREATE TABLE forge_mod (
    sha1 TEXT NOT NULL,
    id TEXT NOT NULL,
    version TEXT NOT NULL
);

CREATE TABLE fabric_mod (
    sha1 TEXT NOT NULL,
    id TEXT NOT NULL,
    version TEXT NOT NULL
);

