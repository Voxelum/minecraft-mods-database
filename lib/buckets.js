const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')

// Number of leading hex chars of the sha1 key used to group entries into a
// single bucket file. 2 chars => 256 buckets, evenly distributed because the
// keys are sha1 hex digests.
const PREFIX_LEN = 2

// The bucket file name that a given key belongs to, e.g. "ab.json".
function bucketName(key) {
  return key.slice(0, PREFIX_LEN).toLowerCase() + '.json'
}

// True if a directory entry is a bucket file (e.g. "ab.json") rather than a
// legacy per-key file (e.g. "<40-hex-sha1>.json") or ".gitkeep".
function isBucketName(name) {
  return /^[0-9a-f]{2}\.json$/.test(name)
}

// Serialize a bucket map to deterministic JSON: keys sorted lexicographically,
// one entry per line. This keeps git diffs small and reviewable (a single
// changed entry produces a single changed line) while staying valid JSON.
function serializeBucket(map) {
  const keys = Object.keys(map).sort()
  let s = '{\n'
  for (let i = 0; i < keys.length; i++) {
    s += '  ' + JSON.stringify(keys[i]) + ': ' + JSON.stringify(map[keys[i]])
    s += (i < keys.length - 1 ? ',' : '') + '\n'
  }
  return s + '}\n'
}

// An in-memory, load-on-demand store over a directory of bucket files. Buckets
// are read once and cached; mutations are buffered and written by flush(). This
// avoids per-key filesystem churn and, crucially, makes concurrent merges into
// keys that share a prefix safe (no read-modify-write race on the same file).
class BucketStore {
  constructor(dir) {
    this.dir = dir
    this.cache = new Map() // bucketName -> { map, dirty }
  }

  async _load(name) {
    let entry = this.cache.get(name)
    if (entry) return entry
    let map = {}
    try {
      map = JSON.parse(await fsp.readFile(path.join(this.dir, name), 'utf-8'))
    } catch (e) {
      if (e.code !== 'ENOENT') throw e
    }
    entry = { map, dirty: false }
    this.cache.set(name, entry)
    return entry
  }

  async get(key) {
    const entry = await this._load(bucketName(key))
    return entry.map[key]
  }

  async has(key) {
    const entry = await this._load(bucketName(key))
    return Object.prototype.hasOwnProperty.call(entry.map, key)
  }

  async set(key, value) {
    const entry = await this._load(bucketName(key))
    entry.map[key] = value
    entry.dirty = true
  }

  async flush() {
    for (const [name, entry] of this.cache) {
      if (!entry.dirty) continue
      await fsp.writeFile(path.join(this.dir, name), serializeBucket(entry.map))
      entry.dirty = false
    }
  }
}

// Synchronously iterate over every [key, value] entry across all bucket files
// in a directory. Used by the build step, which scans the whole dataset.
function* iterateEntries(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (!isBucketName(name)) continue
    const map = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf-8'))
    for (const key of Object.keys(map)) {
      yield [key, map[key]]
    }
  }
}

module.exports = {
  PREFIX_LEN,
  bucketName,
  isBucketName,
  serializeBucket,
  BucketStore,
  iterateEntries,
}
