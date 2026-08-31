import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const PRODUCTION_PROJECT_REF = "kllwwurklumhawfsilpd";
const RECOVERY_URL = process.env.RECOVERY_SUPABASE_URL;
const RECOVERY_SERVICE_ROLE_KEY = process.env.RECOVERY_SUPABASE_SERVICE_ROLE_KEY;
const EXPECTED_RECOVERY_PROJECT_REF = process.env.EXPECTED_RECOVERY_PROJECT_REF;
const SOURCE_DIR = path.resolve(
  process.env.RESTORE_STORAGE_SOURCE_DIR || process.argv[2] || "storage-export",
);

function requireValue(name, value) {
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function projectRefFromUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new Error("Recovery Supabase URL must use HTTPS");
  const suffix = ".supabase.co";
  if (!url.hostname.endsWith(suffix)) {
    throw new Error("Recovery Supabase URL must be a canonical supabase.co project URL");
  }
  return { ref: url.hostname.slice(0, -suffix.length), origin: url.origin };
}

function safeObjectSource(bucketRoot, objectPath) {
  const normalized = objectPath.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (
    normalized.startsWith("/") ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error(`Unsafe Storage object path in manifest: ${objectPath}`);
  }
  const source = path.resolve(bucketRoot, ...segments);
  const prefix = `${path.resolve(bucketRoot)}${path.sep}`;
  if (!source.startsWith(prefix)) {
    throw new Error(`Storage object escaped restore root: ${objectPath}`);
  }
  return source;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

const expectedRef = requireValue(
  "EXPECTED_RECOVERY_PROJECT_REF",
  EXPECTED_RECOVERY_PROJECT_REF,
);
if (expectedRef === PRODUCTION_PROJECT_REF) {
  throw new Error("Recovery target must never be the production project ref");
}

const { ref: actualRef, origin } = projectRefFromUrl(
  requireValue("RECOVERY_SUPABASE_URL", RECOVERY_URL),
);
if (actualRef === PRODUCTION_PROJECT_REF) {
  throw new Error("Refusing Storage restore against production Supabase");
}
if (actualRef !== expectedRef) {
  throw new Error(`Recovery target drift: expected ${expectedRef}, got ${actualRef}`);
}
requireValue("RECOVERY_SUPABASE_SERVICE_ROLE_KEY", RECOVERY_SERVICE_ROLE_KEY);

const manifest = JSON.parse(
  await fs.readFile(path.join(SOURCE_DIR, "manifest.json"), "utf8"),
);
if (manifest.projectRef !== PRODUCTION_PROJECT_REF) {
  throw new Error(
    `Backup manifest source mismatch: expected ${PRODUCTION_PROJECT_REF}, got ${manifest.projectRef}`,
  );
}

const supabase = createClient(origin, RECOVERY_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: existingBuckets, error: bucketListError } = await supabase.storage.listBuckets();
if (bucketListError) throw bucketListError;
const existingById = new Map((existingBuckets || []).map((bucket) => [bucket.id, bucket]));

let restoredObjects = 0;
let restoredBytes = 0;

for (const bucket of manifest.buckets || []) {
  const existing = existingById.get(bucket.id);
  if (!existing) {
    const { error: createError } = await supabase.storage.createBucket(bucket.id, {
      public: Boolean(bucket.public),
      fileSizeLimit: bucket.fileSizeLimit ?? undefined,
      allowedMimeTypes: bucket.allowedMimeTypes ?? undefined,
    });
    if (createError) throw createError;
  } else if (Boolean(existing.public) !== Boolean(bucket.public)) {
    throw new Error(`Bucket visibility mismatch for ${bucket.id}; refusing silent policy drift`);
  }

  for (const object of bucket.objects || []) {
    const source = safeObjectSource(
      path.join(SOURCE_DIR, "objects", bucket.id),
      object.path,
    );
    const buffer = await fs.readFile(source);
    if (buffer.byteLength !== object.size || sha256(buffer) !== object.sha256) {
      throw new Error(`Backup checksum mismatch for ${bucket.id}/${object.path}`);
    }

    const { error: uploadError } = await supabase.storage
      .from(bucket.id)
      .upload(object.path, buffer, {
        upsert: false,
        contentType: object.contentType || undefined,
        cacheControl: object.cacheControl || undefined,
      });
    if (uploadError) throw uploadError;

    const { data: restoredBlob, error: downloadError } = await supabase.storage
      .from(bucket.id)
      .download(object.path);
    if (downloadError) throw downloadError;
    const restoredBuffer = Buffer.from(await restoredBlob.arrayBuffer());
    if (
      restoredBuffer.byteLength !== object.size ||
      sha256(restoredBuffer) !== object.sha256
    ) {
      throw new Error(`Restored Storage checksum mismatch for ${bucket.id}/${object.path}`);
    }

    restoredObjects += 1;
    restoredBytes += buffer.byteLength;
  }
}

console.log(
  `Storage restore complete: ${restoredObjects} objects, ${restoredBytes} bytes restored into ${actualRef}.`,
);
