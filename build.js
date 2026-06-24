const Database = require('better-sqlite3')
const fs = require('fs')
const { resolve } = require('path')
const { iterateEntries } = require('./lib/buckets')
const buildNumber = process.env.BUILD_NUMBER

const migrateScript = fs.readFileSync('./migrate.sql', 'utf-8')
const dbPath = resolve(__dirname, './build/db.sqlite')
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath)
}
const db = new Database(dbPath)
db.exec(migrateScript)

db.prepare('INSERT INTO metadata (version) VALUES (?)').run(buildNumber || 0)

const insertFile = db.prepare('INSERT INTO file (sha1, name, domain) VALUES (?, ?, ?);')
const insertModrinth = db.prepare('INSERT INTO modrinth_version (sha1, project, version) VALUES (?, ?, ?);')
const insertCurseforge = db.prepare('INSERT INTO curseforge_file (sha1, project, file) VALUES (?, ?, ?);')
const insertForge = db.prepare('INSERT INTO forge_mod (sha1, id, version) VALUES (?, ?, ?);')
const insertFabric = db.prepare('INSERT OR IGNORE INTO fabric_mod (sha1, id, version) VALUES (?, ?, ?);')

const mapping = {}
const reversedMapping = {}
const domainMapping = {}
const start = Date.now()
let count = 0
for (const [sha1, content] of iterateEntries('./files-v1')) {
  count++
  try {
    db.transaction((content) => {
      if (!content.domain) return
      insertFile.run(sha1, content.name, content.domain)
      for (const modrinth of content.modrinth || []) {
        insertModrinth.run(sha1, modrinth.projectId, modrinth.versionId)

        if (content.curseforge) {
          const cfId = content.curseforge[0].projectId

          if (!reversedMapping[cfId]) {
            reversedMapping[cfId] = modrinth.projectId
            mapping[modrinth.projectId] = cfId
            domainMapping[modrinth.projectId] = content.domain
          } else {
            if (reversedMapping[cfId] !== modrinth.projectId) {
              console.error(`Conflict: ${cfId} -> ${reversedMapping[cfId]} and ${modrinth.projectId}`)
            }
            if (!domainMapping[modrinth.projectId]) {
              domainMapping[modrinth.projectId] = content.domain
            } else if (domainMapping[modrinth.projectId] !== content.domain) {
              console.error(`Domain Conflict: ${modrinth.projectId} -> ${domainMapping[modrinth.projectId]} and ${content.domain}`)
            }
            if (!mapping[modrinth.projectId]) {
              mapping[modrinth.projectId] = cfId
            } else if (mapping[modrinth.projectId] !== cfId) {
              console.error(`Mapping Conflict: ${modrinth.projectId} -> ${mapping[modrinth.projectId]} and ${cfId}`)
            }
          }
        }
      }
      for (const curseforge of content.curseforge || []) {
        insertCurseforge.run(sha1, curseforge.projectId, curseforge.fileId)
      }
      for (const forge of content.forge || []) {
        insertForge.run(sha1, forge.modId, forge.version ?? "")
      }
      const existed = new Set()
      for (const fabric of content.fabric || []) {
        if (!existed.has(fabric.modId)) {
          insertFabric.run(sha1, fabric.modId, fabric.version ?? "")
          existed.add(fabric.modId)
        }
      }
    })(content)
  } catch (e) {
    console.error(sha1, JSON.stringify(content), e)
  }
}

console.log(`Processed ${count} files`)

for (const [modrinth, curseforge] of Object.entries(mapping)) {
  db.prepare('INSERT INTO project_mapping (curseforge_project, modrinth_project) VALUES (?, ?);')
    .run(curseforge, modrinth)
}

console.log('Time:', Math.floor((Date.now() - start) / 1000))
const stat = fs.statSync(dbPath)
console.log('db.sqlite Size:', Math.floor(stat.size / 1024 / 1024), 'MB')
const sha1 = require('crypto').createHash('sha1')
  .update(fs.readFileSync(dbPath))
  .digest('hex')
console.log('db.sqlite SHA1:', sha1)
fs.writeFileSync('./build/db.sqlite.sha1', sha1)

const entries = Object.entries(mapping)
let result = ''
for (let i = 0; i < entries.length; ++i) {
  const [modrinth, curseforge] = entries[i]
  result += modrinth + ',' + curseforge + ',' + domainMapping[modrinth] + '\n'
}

fs.writeFileSync('./build/project_mapping.csv', result)
const sha1Bin = require('crypto').createHash('sha1')
  .update(result)
  .digest('hex')
console.log('project_mapping.csv SHA1:', sha1Bin)
fs.writeFileSync('./build/project_mapping.csv.sha1', sha1Bin)
