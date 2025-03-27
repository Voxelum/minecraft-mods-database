require('dotenv').config()
const { BlobServiceClient } = require("@azure/storage-blob");
const fs = require("fs/promises");
const { createHash } = require("crypto");

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
const parseIfExist = (v) => (v ? JSON.parse(v) : undefined);

const formatName = (n) => n.substring('WorkspaceResourceId=/subscriptions/d3076e5f-e198-4e44-a689-837848a5f2be/resourcegroups/xmcl/providers/microsoft.operationalinsights/workspaces/'.length)

const handleMetadata = async (metadata) => {
  const { name, sha1, domain, modrinth, curseforge, forge, fabric } =
    metadata;
  const localFile = `./files-v1/${sha1}.json`;
  if (!sha1) return;
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
}

async function main() {
  const connectionString =
    process.env.AZURE_STORAGE_CONNECTION_STRING;
  const client = BlobServiceClient.fromConnectionString(connectionString);

  const handle = async (containerClient, blob) => {
    const shortBlobname = formatName(blob.name);
    const blobClient = containerClient.getBlobClient(blob.name);
    try {
      const resp = await blobClient.download();

      console.log("Processing", shortBlobname);
      const stringContent = (
        await streamToBuffer(resp.readableStreamBody)
      ).toString();
      const objects = stringContent
        .split("\r\n")
        .map((v) => v.trim())
        .filter((v) => !!v)
        .map(JSON.parse);
      for (const e of objects) {
        if (e.Name === "resource-metadata-v2") {
          await handleMetadata(e.Properties)
        } else if (e.Name === "minecraft-run-record-v2") {
          const props = e.Properties;
          const record = {
            mods: props.mods.split(","),
            runtime: parseIfExist(props.runtime),
            java: parseIfExist(props.java),
          };
          for (const k in record.runtime) {
            if (!record.runtime[k]) {
              delete record.runtime[k];
            }
          }
          const rec = JSON.stringify(record, null, 2);
          const key = createHash("sha1").update(rec).digest("hex");
          await fs.writeFile(`./runs-v1/${key}.json`, rec);
        } else if (e.Type === 'AppTraces') {
          await handleMetadata(e.Message)
        }
      }
      console.log("Processed", shortBlobname);
      await blobClient.delete();
    } catch (e) {
      if (e instanceof SyntaxError) {
        await blobClient.delete();
      }
      console.error("Failed to process blob", shortBlobname);
      console.error(e);
    }
  };

  const batch = [];
  const enqueue = async (client, blob) => {
    batch.push(blob);
    if (batch.length === 32) {
      await Promise.all(batch.map((b) => handle(client, b)));
      batch.length = 0;
    }
  }

  const events = client.getContainerClient("am-appevents");
  const eventBlobs = events.listBlobsFlat({});
  for await (const blob of eventBlobs) {
    await enqueue(events, blob)
  }

  if (batch.length) {
    await Promise.all(batch.map(b => handle(events, b)));
    batch.length = 0;
  }

  const traces = client.getContainerClient("am-apptraces");
  const traceBlobs = traces.listBlobsFlat({});
  for await (const blob of traceBlobs) {
    await enqueue(traces, blob)
  }

  if (batch.length) {
    await Promise.all(batch.map(b => handle(traces, b)));
    batch.length = 0;
  }
}

main();
