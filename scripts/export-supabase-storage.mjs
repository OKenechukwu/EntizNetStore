import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const EXPECTED_PROJECT_REF =
  process.env.EXPECTED_SUPABASE_PROJECT_REF || "kllwwurklumhawfsilpd";
const SUPABASE_URL = process.env.PRODUCTION_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY;
const OUTPUT_DIR = path.resolve(
  process.env.BACKUP_STORAGE_OUTPUT_DIR || process.argv[2] || "storage-export",
);
const PAGE_SIZE = 1000;
const MAX_DEPTH = 64;

function requireValue(name, value) {
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function assertProductionUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") {
    throw new Error("Production Supabase URL must use HTTPS");
  }
  const expectedHost = `${EXPECTED_PROJECT_REF}.supabase.co`;
  if (url.hostname !== expectedHost) {
    throw new Error(
      `Refusing Storage backup: expected ${expectedHost}, got ${url.hostname}`,
    );
  }
  return url.origin;
}

function assertSafeBucketId(bucketId) {
  if (!/^[A-Za-z0-9._-]+$/.test(bucketId)) {
    throw new Error(`Unsafe Storage bucket id: ${bucketId}`);
  }
}

function safeObjectTarget(bucketRoot, objectPath) {
  const normalized = objectPath.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (
    normalized.startsWith("/") ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error(`Unsafe Storage object path encountered: ${objectPath}`);
  }

  const target = path.resolve(bucketRoot, ...segments);
  const prefix = `${path.resolve(bucketRoot)}${path.sep}`;
  if (!target.startsWith(prefix)) {
    throw new Error(`Storage object escaped backup root: ${objectPath}`);
  }
  return target;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

const productionUrl = assertProductionUrl(
  requireValue("PRODUCTION_SUPABASE_URL", SUPABASE_URL),
);
requireValue("PRODUCTION_SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE_KEY);

const supabase = createClient(productionUrl, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
await fs.mkdir(OUTPUT_DIR, { recursive: true, mode: 0o700 });

const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
if (bucketError) throw bucketError;

const manifest = {
  formatVersion: 1,
  projectRef: EXPECTED_PROJECT_REF,
  createdAt: new Date().toISOString(),
  buckets: [],
};

async function walkBucket(bucket, prefix = "", depth = 0) {
  if (depth > MAX_DEPTH) {
    throw new Error(`Storage path nesting exceeds ${MAX_DEPTH} levels in ${bucket.id}`);
  }

  let offset = 0;
  for (;;) {
    const { data: entries, error } = await supabase.storage.from(bucket.id).list(prefix, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    if (!entries || entries.length === 0) break;

    for (const entry of entries) {
      const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const isFolder = entry.id == null || entry.metadata == null;
      if (isFolder) {
        await walkBucket(bucket, objectPath, depth + 1);
        continue;
      }

      const { data: blob, error: downloadError } = await supabase.storage
        .from(bucket.id)
        .download(objectPath);
      if (downloadError) throw downloadError;

      const buffer = Buffer.from(await blob.arrayBuffer());
      const bucketRoot = path.join(OUTPUT_DIR, "objects", bucket.id);
      const target = safeObjectTarget(bucketRoot, objectPath);
      await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
      await fs.writeFile(target, buffer, { mode: 0o600 });

      manifest.buckets.find((item) => item.id === bucket.id).objects.push({
        path: objectPath,
        size: buffer.byteLength,
        sha256: sha256(buffer),
        contentType:
          typeof entry.metadata?.mimetype === "string"
            ? entry.metadata.mimetype
            : null,
        cacheControl:
          typeof entry.metadata?.cacheControl === "string"
            ? entry.metadata.cacheControl
            : null,
      });
    }

    if (entries.length < PAGE_SIZE) break;
    offset += entries.length;
  }
}

for (const bucket of buckets || []) {
  assertSafeBucketId(bucket.id);
  manifest.buckets.push({
    id: bucket.id,
    public: Boolean(bucket.public),
    fileSizeLimit: bucket.file_size_limit ?? null,
    allowedMimeTypes: bucket.allowed_mime_types ?? null,
    objects: [],
  });
  await walkBucket(bucket);
}

manifest.summary = {
  bucketCount: manifest.buckets.length,
  objectCount: manifest.buckets.reduce((sum, bucket) => sum + bucket.objects.length, 0),
  totalBytes: manifest.buckets.reduce(
    (sum, bucket) =>
      sum + bucket.objects.reduce((bucketSum, object) => bucketSum + object.size, 0),
    0,
  ),
};

await fs.writeFile(
  path.join(OUTPUT_DIR, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  { mode: 0o600 },
);

console.log(
  `Storage backup complete: ${manifest.summary.bucketCount} buckets, ${manifest.summary.objectCount} objects, ${manifest.summary.totalBytes} bytes.`,
);
