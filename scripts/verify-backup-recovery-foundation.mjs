import fs from "node:fs";

const failures = [];
const read = (file) => fs.readFileSync(file, "utf8");
const exists = (file) => fs.existsSync(file);
const fail = (message) => failures.push(message);

const pins = {
  checkout: "3d3c42e5aac5ba805825da76410c181273ba90b1",
  setupNode: "820762786026740c76f36085b0efc47a31fe5020",
  supabaseCli: "ab058987d8d6c725971f6cf9d0b5c98467e30bd1",
};

const requiredFiles = [
  ".github/workflows/production-backup.yml",
  ".github/workflows/restore-rehearsal.yml",
  "scripts/export-supabase-storage.mjs",
  "scripts/restore-supabase-storage.mjs",
  "docs/operations/BACKUP_RECOVERY.md",
];
for (const file of requiredFiles) {
  if (!exists(file)) fail(`Backup/recovery foundation file missing: ${file}`);
}

if (exists(".github/workflows/production-backup.yml")) {
  const source = read(".github/workflows/production-backup.yml");
  const requiredFragments = [
    "workflow_dispatch:",
    "contents: read",
    `actions/checkout@${pins.checkout}`,
    `actions/setup-node@${pins.setupNode}`,
    `supabase/setup-cli@${pins.supabaseCli}`,
    "persist-credentials: false",
    "BACKUP_REASON: ${{ inputs.reason }}",
    "--arg value \"$BACKUP_REASON\"",
    "version: 2.111.0",
    "--role-only",
    "--data-only",
    "--use-copy",
    "-x \"storage.objects\"",
    "-x \"storage.buckets_vectors\"",
    "-x \"storage.vector_indexes\"",
    "--schema supabase_migrations",
    "scripts/export-supabase-storage.mjs",
    "age -r",
    "aws s3 cp",
    "aws s3api head-object",
    "PRODUCTION_SUPABASE_DB_URL",
    "kllwwurklumhawfsilpd",
  ];
  for (const fragment of requiredFragments) {
    if (!source.includes(fragment)) fail(`Production backup workflow lost required control: ${fragment}`);
  }
  if (/^\s*schedule\s*:/m.test(source)) {
    fail("Production backup schedule must remain disabled until off-platform credentials are provisioned and a manual backup succeeds");
  }
  if (/upload-artifact/i.test(source)) {
    fail("Production customer backups must not be retained as GitHub Actions artifacts");
  }
}

if (exists(".github/workflows/restore-rehearsal.yml")) {
  const source = read(".github/workflows/restore-rehearsal.yml");
  for (const fragment of [
    "workflow_dispatch:",
    `actions/checkout@${pins.checkout}`,
    `actions/setup-node@${pins.setupNode}`,
    "persist-credentials: false",
    "confirm_recovery_target",
    "CONFIRM_RECOVERY_TARGET: ${{ inputs.confirm_recovery_target }}",
    "BACKUP_OBJECT_KEY: ${{ inputs.backup_object_key }}",
    "kllwwurklumhawfsilpd",
    "BACKUP_AGE_IDENTITY",
    "psql --single-transaction",
    "scripts/restore-supabase-storage.mjs",
    "Recovery database URL does not contain the confirmed recovery project ref",
    "Recovery target is not blank; refusing to overwrite an existing environment",
    "verify-m4a-database-invariants.sql",
  ]) {
    if (!source.includes(fragment)) fail(`Restore rehearsal workflow lost required control: ${fragment}`);
  }
}

for (const file of [
  "scripts/export-supabase-storage.mjs",
  "scripts/restore-supabase-storage.mjs",
]) {
  if (!exists(file)) continue;
  const source = read(file);
  if (!source.includes("kllwwurklumhawfsilpd")) {
    fail(`${file} must carry the canonical production project safety boundary`);
  }
  if (/console\.(log|error)\([^\n]*(SERVICE_ROLE|service[_ -]?role)/i.test(source)) {
    fail(`${file} may not log service-role credentials`);
  }
}

if (failures.length > 0) {
  console.error("Backup/recovery foundation verification FAILED:\n");
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log("Backup/recovery foundation verification passed with immutable Actions and input-to-env guards.");
