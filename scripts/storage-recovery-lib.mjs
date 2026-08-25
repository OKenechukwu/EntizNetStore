import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const CANONICAL_STORAGE_BUCKETS = Object.freeze([
  "kyc-documents",
  "product-media",
  "seller-branding",
  "message-attachments",
]);

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function parseBuckets(value = "") {
  const requested = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const buckets = requested.length ? requested : [...CANONICAL_STORAGE_BUCKETS];
  const unknown = buckets.filter((bucket) => !CANONICAL_STORAGE_BUCKETS.includes(bucket));
  if (unknown.length) {
    throw new Error(`Unknown recovery bucket(s): ${unknown.join(", ")}`);
  }
  return [...new Set(buckets)];
}

export function safeObjectFile(root, bucket, objectName) {
  const bucketRoot = path.resolve(root, "storage", bucket);
  const candidate = path.resolve(bucketRoot, ...objectName.split("/"));
  if (candidate !== bucketRoot && !candidate.startsWith(`${bucketRoot}${path.sep}`)) {
    throw new Error(`Unsafe Storage object path: ${bucket}/${objectName}`);
  }
  return candidate;
}

export async function listBucketObjects(client, bucket) {
  const storage = client.storage.from(bucket);
  const objects = [];

  async function visit(prefix = "") {
    const pageSize = 1000;
    let offset = 0;
    while (true) {
      const { data, error } = await storage.list(prefix, {
        limit: pageSize,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error(`Unable to list ${bucket}/${prefix}: ${error.message}`);
      const entries = data ?? [];

      for (const entry of entries) {
        const name = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id) {
          objects.push({ name, metadata: entry.metadata ?? null });
        } else {
          await visit(name);
        }
      }

      if (entries.length < pageSize) break;
      offset += entries.length;
    }
  }

  await visit();
  return objects;
}

export async function downloadObject(client, bucket, objectName) {
  const { data, error } = await client.storage.from(bucket).download(objectName);
  if (error) throw new Error(`Unable to download ${bucket}/${objectName}: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function writeObject(root, bucket, objectName, bytes) {
  const file = safeObjectFile(root, bucket, objectName);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes, { flag: "wx" });
  return file;
}

export async function readObject(root, bucket, objectName) {
  return fs.readFile(safeObjectFile(root, bucket, objectName));
}

export async function assertEmptyBuckets(client, buckets) {
  for (const bucket of buckets) {
    const existing = await listBucketObjects(client, bucket);
    if (existing.length) {
      throw new Error(
        `Refusing recovery into non-empty bucket ${bucket} (${existing.length} object(s)). ` +
          "Use a disposable/empty restore target.",
      );
    }
  }
}
