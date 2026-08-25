import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  downloadObject,
  listBucketObjects,
  parseBuckets,
  sha256,
  writeObject,
} from "./storage-recovery-lib.mjs";

const url = process.env.RECOVERY_SUPABASE_URL;
const serviceRoleKey = process.env.RECOVERY_SUPABASE_SERVICE_ROLE_KEY;
const output = path.resolve(process.env.RECOVERY_OUTPUT_DIR || "backups/recovery-storage");
const buckets = parseBuckets(process.env.RECOVERY_STORAGE_BUCKETS);

if (!url || !serviceRoleKey) {
  throw new Error(
    "RECOVERY_SUPABASE_URL and RECOVERY_SUPABASE_SERVICE_ROLE_KEY are required",
  );
}

await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(path.join(output, "storage"), { recursive: true });

const client = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const manifest = {
  version: 1,
  generated_at: new Date().toISOString(),
  source_origin: new URL(url).origin,
  buckets: [],
  objects: [],
  totals: { objects: 0, bytes: 0 },
};

for (const bucket of buckets) {
  const objects = await listBucketObjects(client, bucket);
  let bucketBytes = 0;

  for (const object of objects) {
    const bytes = await downloadObject(client, bucket, object.name);
    await writeObject(output, bucket, object.name, bytes);
    const record = {
      bucket,
      path: object.name,
      bytes: bytes.length,
      sha256: sha256(bytes),
      content_type: object.metadata?.mimetype ?? object.metadata?.contentType ?? null,
    };
    manifest.objects.push(record);
    bucketBytes += bytes.length;
  }

  manifest.buckets.push({ bucket, objects: objects.length, bytes: bucketBytes });
  manifest.totals.objects += objects.length;
  manifest.totals.bytes += bucketBytes;
  process.stdout.write(`backed up ${bucket}: ${objects.length} object(s), ${bucketBytes} byte(s)\n`);
}

await fs.writeFile(
  path.join(output, "storage-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  { flag: "wx" },
);

process.stdout.write(
  `Storage backup complete: ${manifest.totals.objects} object(s), ${manifest.totals.bytes} byte(s) -> ${output}\n`,
);
