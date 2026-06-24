# Minecraft Mods Database (Cosmos Project)

> Many launchers want to know the linked modrinth, curseforge project from the mod files. Therefore we initiate the Cosmos project to collect the data and create lookup database.

This repo contains the raw metadata of mods, resource packs, shader packs for Minecraft.

It intends to collect the parsed data from files to create database accordingly.
You can build various table for database from these raw data.

## Storage layout

The metadata lives under `files-v1`. Each entry is keyed by the **file content
sha1** and stores the metadata of that file, including

- `modrinth`: The modrinth project id and version id
- `curseforge`: The curseforge project id and file id
- `forge`: The forge mod id and version
- `fabric`: The fabric mod id and version
- `domain`: Either `mods`, `resourcepacks`, `shaderpacks` or `saves`

To avoid hundreds of thousands of tiny files, entries are **bucketed by the
first two hex characters of their sha1**: `files-v1/<xx>.json` is a single JSON
object mapping each `sha1` in that bucket to its metadata. This yields 256
evenly sized bucket files (the keys are uniformly distributed sha1 digests).
Entries are written one per line and sorted by key so a change to a single
entry produces a small, reviewable diff.

Minecraft run records are stored the same way under `runs-v1/<xx>.json`, keyed
by the sha1 of the record.

The bucket read/write/merge helpers live in `lib/buckets.js` and are shared by
`index.js` (harvester) and `build.js` (database builder).

## Current status

- [x] Working script to harvest stored json data
- [x] Cron job to run harvest script in a comfortable interval (weekly, see `.github/workflows/harvest.yml`)
- [x] Add script and release pipeline to build the sqlite database