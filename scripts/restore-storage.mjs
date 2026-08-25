import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  assertEmptyBuckets,
  downloadObject,
  parseBuckets,
  readObject,
  sha256,
} from "./storage-recovery-lib.mjs";

const url = process.env.RECOVERY_RESTORE_SUPABASE_URL;
const serviceRoleKey = process.env.RECOVERY_RESTORE_SERVICE_ROLE_KEY;
const input = path.resolve(process.env.RECOVERY_INPUT_DIR || "backups/recovery-storage");
const confirmation = process.env.RECOVERY_RESTORE_CONFIRM;

if (!url || !serviceRoleKey) {
  throw new Error(
    "RECOVERY_RESTORE_SUPABASE_URL and RECOVERY_RESTORE_SERVICE_ROLE_KEY are required",
  );
}
if (confirmation !== "RESTORE_TO_DISPOSABLE_TARGET") {
  throw new Error(
    "Recovery is fail-closed. Set RECOVERY_RESTORE_CONFIRM=RESTORE_TO_DISPOSABLE_TARGET only for an approved empty restore target.",
  );
}

const manifest = JSON.parse(
  await fs.readFile(path.join(input, "storage-manifest.json"), "utf8"),
);
if (manifest.version !== 1 || !Array.isArray(manifest.objects)) {
  throw new Error("Unsupported or invalid Storage recovery manifest");
}

const buckets = parseBuckets(
  manifest.buckets?.map((entry) => entry.bucket).join(",") || "",
);
const client = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

await assertEmptyBuckets(client, buckets);

for (const object of manifest.objects) {
  if (!buckets.includes(object.bucket)) {
    throw new Error(`Manifest contains unexpected bucket ${object.bucket}`);
  }
  const bytes = await readObject(input, object.bucket, object.path);
  if (bytes.length !== object.bytes || sha256(bytes) !== object.sha256) {
    throw new Error(`Backup integrity mismatch before restore: ${object.bucket}/${object.path}`);
  }

  const { error } = await client.storage.from(object.bucket).upload(object.path, bytes, {
    upsert: false,
    contentType: object.content_type || "application/octet-stream",
  });
  if (error) throw new Error(`Unable to restore ${object.bucket}/${object.path}: ${error.message}`);
}

for (const object of manifest.objects) {
  const restored = await downloadObject(client, object.bucket, object.path);
  if (restored.length !== object.bytes || sha256(restored) !== object.sha256) {
    throw new Error(`Restored object verification failed: ${object.bucket}/${object.path}`);
  }
}

process.stdout.write(
  `Storage restore verified: ${manifest.objects.length} object(s) into ${new URL(url).origin}\n`,
);
