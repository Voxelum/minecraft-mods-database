CREATE TABLE metadata (
    version INTEGER NOT NULL;
);

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
    sha1 TEXT NOT NULL,
    project TEXT NOT NULL,
    version TEXT NOT NULL,
    PRIMARY KEY (sha1, project, version)
);

CREATE TABLE curseforge_file (
    sha1 TEXT NOT NULL,
    project INTEGER NOT NULL,
    file INTEGER NOT NULL,
    PRIMARY KEY (sha1, project, file)
);

CREATE TABLE forge_mod (
    sha1 TEXT NOT NULL,
    id TEXT NOT NULL,
    version TEXT NOT NULL,
    PRIMARY KEY (sha1, id, version)
);

CREATE TABLE fabric_mod (
    sha1 TEXT NOT NULL,
    id TEXT NOT NULL,
    version TEXT NOT NULL,
    PRIMARY KEY (sha1, id, version)
);

