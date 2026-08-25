import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import {
  CANONICAL_STORAGE_BUCKETS,
  downloadObject,
  listBucketObjects,
  sha256,
} from "./storage-recovery-lib.mjs";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const client = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const runId = randomUUID();
const output = await fs.mkdtemp(path.join(os.tmpdir(), "entiznetstore-recovery-"));
const seeded = [];

function runNode(script, extraEnv) {
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert.equal(result.status, 0, `${script} exited with ${result.status}`);
}

try {
  for (const bucket of CANONICAL_STORAGE_BUCKETS) {
    const existing = await listBucketObjects(client, bucket);
    assert.equal(existing.length, 0, `${bucket} must be empty before isolated recovery rehearsal`);

    const objectPath = `recovery-rehearsal/${runId}/${bucket}.txt`;
    const bytes = Buffer.from(`EntizNetStore recovery rehearsal ${runId} ${bucket}\n`, "utf8");
    const { error } = await client.storage.from(bucket).upload(objectPath, bytes, {
      upsert: false,
      contentType: "text/plain",
    });
    assert.equal(error, null, `unable to seed ${bucket}: ${error?.message ?? "unknown"}`);
    seeded.push({ bucket, path: objectPath, bytes });
  }

  runNode("scripts/backup-storage.mjs", {
    RECOVERY_SUPABASE_URL: url,
    RECOVERY_SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    RECOVERY_OUTPUT_DIR: output,
  });

  const manifest = JSON.parse(
    await fs.readFile(path.join(output, "storage-manifest.json"), "utf8"),
  );
  assert.equal(manifest.totals.objects, seeded.length, "manifest object count mismatch");
  assert.equal(manifest.buckets.length, CANONICAL_STORAGE_BUCKETS.length, "manifest bucket count mismatch");

  for (const expected of seeded) {
    const record = manifest.objects.find(
      (item) => item.bucket === expected.bucket && item.path === expected.path,
    );
    assert.ok(record, `manifest missing ${expected.bucket}/${expected.path}`);
    assert.equal(record.bytes, expected.bytes.length);
    assert.equal(record.sha256, sha256(expected.bytes));
  }

  for (const expected of seeded) {
    const { error } = await client.storage.from(expected.bucket).remove([expected.path]);
    assert.equal(error, null, `unable to clear ${expected.bucket}: ${error?.message ?? "unknown"}`);
  }

  for (const bucket of CANONICAL_STORAGE_BUCKETS) {
    const existing = await listBucketObjects(client, bucket);
    assert.equal(existing.length, 0, `${bucket} must be empty before restore`);
  }

  runNode("scripts/restore-storage.mjs", {
    RECOVERY_RESTORE_SUPABASE_URL: url,
    RECOVERY_RESTORE_SERVICE_ROLE_KEY: serviceRoleKey,
    RECOVERY_RESTORE_CONFIRM: "RESTORE_TO_DISPOSABLE_TARGET",
    RECOVERY_INPUT_DIR: output,
  });

  for (const expected of seeded) {
    const restored = await downloadObject(client, expected.bucket, expected.path);
    assert.equal(restored.length, expected.bytes.length);
    assert.equal(sha256(restored), sha256(expected.bytes));
  }

  process.stdout.write("Storage recovery round-trip rehearsal passed\n");
} finally {
  for (const expected of seeded) {
    await client.storage.from(expected.bucket).remove([expected.path]).catch(() => {});
  }
  await fs.rm(output, { recursive: true, force: true });
}
