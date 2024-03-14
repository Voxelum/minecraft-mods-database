CREATE TABLE project_mapping (
    curseforge_project INTEGER NOT NULL,
    modrinth_project TEXT NOT NULL,
    PRIMARY KEY (curseforge_project, modrinth_project)
);

CREATE TABLE file (
    sha1 TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT NOT NULL
);

CREATE TABLE modrinth_version (
    sha1 TEXT PRIMARY KEY,
    project TEXT NOT NULL,
    version TEXT NOT NULL,
    UNIQUE (project, version)
);

CREATE TABLE curseforge_file (
    sha1 TEXT PRIMARY KEY,
    project INTEGER NOT NULL,
    file INTEGER NOT NULL,
    UNIQUE (project, file)
);

CREATE TABLE forge_mod (
    sha1 TEXT PRIMARY KEY,
    id TEXT NOT NULL,
    version TEXT NOT NULL,
    UNIQUE (id, version)
);

CREATE TABLE fabric_mod (
    sha1 TEXT PRIMARY KEY,
    id TEXT NOT NULL,
    version TEXT NOT NULL,
    UNIQUE (id, version)
);

