# Minecraft Mods Database (Cosmos Project)

> Many launchers want to know the linked modrinth, curseforge project from the mod files. Therefore we initiate the Cosmos project to collect the data and create lookup database.

This repo contains the raw metadata of mods, resource packs, shader packs for Minecraft.

It intends to collect the parsed data from files to create database accordingly.
You can build various table for database from these raw data.

Each file under the folder `files-v1` is named by the file content sha1. It stores the metadata of the file, including
- `modrinth`: The modrinth project id and version id
- `curseforge`: The curseforge project id and file id
- `forge`: The forge mod id and version
- `fabric`: The fabric mod id and version
- `domain`: Either `mods`, `resourcepacks`, `shaderpacks` or `saves`

## Current status

- [x] Working script to harvest stored json data
- [ ] Corn job to run harvest script in a comfortable interval
- [x] Add script and release pipeline to build the sqlite database