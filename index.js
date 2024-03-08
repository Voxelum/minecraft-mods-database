const { BlobServiceClient } = require("@azure/storage-blob");
const fs = require("fs/promises");
const { createHash } = require('crypto')

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

const client = BlobServiceClient.fromConnectionString(connectionString);

async function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on("data", (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on("error", reject);
  });
}
const events = client.getContainerClient("am-appevents");
const blobs = events.listBlobsFlat({ includeTags: true });


const parseIfExist = (v) => (v ? JSON.parse(v) : undefined);
const process = async (blob) => {
  try {
    const blobClient = events.getBlobClient(blob.name);
    const resp = await blobClient.download();

    console.log("Processing", blob.name);
    const objects = (await streamToBuffer(resp.readableStreamBody))
      .toString()
      .split("\r\n")
      .map(JSON.parse);
    for (const e of objects) {
      if (e.name === "resource-metadata-v2") {
        const { name, sha1, domain, modrinth, curseforge, forge, fabric } =
          e.Properties;
        const localFile = `./files-v1/${sha1}.json`;
        const localContent = await fs
          .readFile(localFile, "utf-8")
          .then(JSON.parse)
          .catch(() => ({}));
        const mergeForge = (old, newContent) => {
          if (!newContent) return old;
          if (!old) return [newContent];
          const existed = old.find(
            (v) =>
              v.modId === newContent.modId && v.version === newContent.version
          );
          if (!existed) {
            old.push(newContent);
          }
          return old;
        };
        const mergeCurseforge = (old, newContent) => {
          if (!newContent) return old;
          if (!old) return [newContent];
          const existed = old.find(
            (v) =>
              v.projectId === newContent.projectId &&
              v.fileId === newContent.fileId
          );
          if (!existed) {
            old.push(newContent);
          }
          return old;
        };
        const mergeModrinth = (old, newContent) => {
          if (!newContent) return old;
          if (!old) return [newContent];
          const existed = old.find(
            (v) =>
              v.projectId === newContent.projectId &&
              v.versionId === newContent.versionId
          );
          if (!existed) {
            old.push(newContent);
          }
          return old;
        };
        const mergeFabric = (old, newContent) => {
          if (!newContent) return old;
          if (!old) return newContent;
          for (const c of newContent) {
            const existed = old.find(
              (v) => v.modId === c.modId && v.version === c.version
            );
            if (!existed) {
              old.push(...newContent);
            }
          }
          return old;
        };

        // Merge local content
        const content = {
          name: localContent.name || name,
          domain: domain || localContent.domain,
          modrinth: mergeModrinth(
            localContent.modrinth,
            parseIfExist(modrinth)
          ),
          curseforge: mergeCurseforge(
            localContent.curseforge,
            parseIfExist(curseforge)
          ),
          forge: mergeForge(localContent.forge, parseIfExist(forge)),
          fabric: mergeFabric(localContent.fabric, parseIfExist(fabric)),
        };
        await fs.writeFile(localFile, JSON.stringify(content, null, 2));
      } else if (e.name === "minecraft-run-record-v2") {
        const props = e.Properties;
        const record = {
          mods: props.mods.split(","),
          runtime: parseIfExist(props.runtime),
          java: parseIfExist(props.java),
        };
        for (const k of record.runtime) {
          if (!record.runtime[k]) {
            delete record.runtime[k];
          }
        }
        const rec = JSON.stringify(record, null, 2);
        const key = createHash('sha1').update(rec).digest('hex');
        await fs.writeFile(`./run-record-v1/${key}.json`, rec);
      }
    }

    await blobClient.delete();
    console.log("Processed", blob.name);
  } catch (e) {
    console.error("Failed to process blob", blob.name);
    console.error(e);
  }
};

const batch = [];
for await (const blob of blobs) {
  batch.push(blob);
  if (batch.length === 32) {
    await Promise.all(batch.map(process));
    batch.length = 0;
  }
}
