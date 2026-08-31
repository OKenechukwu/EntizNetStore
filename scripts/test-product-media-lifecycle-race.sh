#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
ACTOR_ID="c3000000-0000-4000-8000-000000000003"
JOB_ID="c8000000-0000-4000-8000-000000000008"
OBJECT_PATH="${ACTOR_ID}/88888888-8888-4888-8888-888888888888.webp"
PUBLIC_URL="https://example.supabase.co/storage/v1/object/public/product-media/${OBJECT_PATH}"

TMP_DIR="$(mktemp -d)"
ATTACH_READY="${TMP_DIR}/attach-ready"
CLAIM_READY="${TMP_DIR}/claim-ready"
ATTACH_LOG="${TMP_DIR}/attach.log"
CLAIM_LOG="${TMP_DIR}/claim.log"
REATTACH_LOG="${TMP_DIR}/reattach.log"
IMMUTABLE_LOG="${TMP_DIR}/immutable.log"
export ATTACH_READY CLAIM_READY

cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

wait_for_file() {
  local path="$1"
  local log="$2"
  for _ in $(seq 1 200); do
    if [[ -f "${path}" ]]; then
      return 0
    fi
    sleep 0.05
  done
  echo "Timed out waiting for race fixture: ${path}" >&2
  [[ -f "${log}" ]] && cat "${log}" >&2
  return 1
}

psql "${DB_URL}" -v ON_ERROR_STOP=1 <<SQL
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '${ACTOR_ID}',
  'authenticated',
  'authenticated',
  'media-lifecycle-race@test.invalid',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.profiles_buyer(id, display_name)
values ('${ACTOR_ID}', 'Media Lifecycle Race Seller');

insert into public.profiles_seller(
  id, storefront_name, business_type, verification_status, shipping_policy, return_policy
)
values (
  '${ACTOR_ID}',
  'Media Lifecycle Race Store',
  'individual',
  'verified',
  'Tracked shipping for isolated lifecycle race regression.',
  'Returns accepted for isolated lifecycle race regression.'
);

insert into storage.objects(bucket_id, name, metadata)
values (
  'product-media',
  '${OBJECT_PATH}',
  '{"mimetype":"image/webp","size":128}'::jsonb
);

insert into public.upload_scan_jobs(
  id, actor_id, purpose, quarantine_path, destination_bucket, destination_path,
  declared_mime, verified_mime, byte_size, sha256, status, scanner,
  scanner_version, scanner_result_code, scanned_at, promoted_at
)
values (
  '${JOB_ID}',
  '${ACTOR_ID}',
  'product_media',
  '${ACTOR_ID}/product_media/${JOB_ID}.webp',
  'product-media',
  '${OBJECT_PATH}',
  'image/webp',
  'image/webp',
  128,
  repeat('8', 64),
  'clean',
  'ci-lifecycle-race',
  '1',
  'clean',
  now(),
  now()
);
SQL

# Ordering 1: catalogue attachment gets the object lock first. The orphan claim
# must wait for that transaction and then observe the committed reference.
psql "${DB_URL}" -v ON_ERROR_STOP=1 >"${ATTACH_LOG}" 2>&1 <<SQL &
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '${ACTOR_ID}', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"${ACTOR_ID}","role":"authenticated","iss":"https://example.supabase.co/auth/v1"}',
  true
);
select public.seller_save_product_v3(
  null,
  'Lifecycle Race Attach Wins',
  'CI-only product proving attachment wins cannot be deleted as an orphan.',
  'CI lifecycle race attach wins',
  'physical',
  31.00,
  null,
  null,
  null,
  '{}'::uuid[],
  array['${PUBLIC_URL}'],
  '[{"title":"Default","price":31,"trackInventory":true,"inventoryQuantity":2,"inventoryPolicy":"deny","requiresShipping":true,"isActive":true}]'::jsonb,
  true,
  false,
  true,
  true,
  100,
  null,
  18,
  array['ci-lifecycle-race'],
  array['ci-lifecycle-race']
);
\! touch "$ATTACH_READY"
select pg_sleep(2);
commit;
SQL
ATTACH_PID=$!

wait_for_file "${ATTACH_READY}" "${ATTACH_LOG}"
CLAIM_RESULT="$(psql "${DB_URL}" -v ON_ERROR_STOP=1 -Atqc "set role service_role; select public.service_claim_product_media_orphan('${ACTOR_ID}'::uuid, '${OBJECT_PATH}');")"
wait "${ATTACH_PID}"

if [[ "${CLAIM_RESULT}" != "referenced" ]]; then
  echo "Attach-wins race expected referenced, got: ${CLAIM_RESULT}" >&2
  cat "${ATTACH_LOG}" >&2
  exit 1
fi

PRODUCT_ID="$(psql "${DB_URL}" -v ON_ERROR_STOP=1 -Atqc "select id from public.products where seller_id='${ACTOR_ID}'::uuid and title='Lifecycle Race Attach Wins' limit 1;")"
if [[ -z "${PRODUCT_ID}" ]]; then
  echo "Attach-wins fixture product was not committed" >&2
  exit 1
fi

# Remove the final catalogue reference through the same authenticated Seller RPC
# used by production edits. The scanner provenance remains clean and attachable
# until the subsequent orphan claim wins the lock.
psql "${DB_URL}" -v ON_ERROR_STOP=1 <<SQL
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '${ACTOR_ID}', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"${ACTOR_ID}","role":"authenticated","iss":"https://example.supabase.co/auth/v1"}',
  true
);
select public.seller_save_product_v3(
  '${PRODUCT_ID}'::uuid,
  'Lifecycle Race Attach Wins',
  'CI-only product proving attachment wins cannot be deleted as an orphan.',
  'CI lifecycle race attach wins',
  'physical',
  31.00,
  null,
  null,
  null,
  '{}'::uuid[],
  '{}'::text[],
  '[{"title":"Default","price":31,"trackInventory":true,"inventoryQuantity":2,"inventoryPolicy":"deny","requiresShipping":true,"isActive":true}]'::jsonb,
  true,
  false,
  true,
  true,
  100,
  null,
  18,
  array['ci-lifecycle-race'],
  array['ci-lifecycle-race']
);
commit;
SQL

# Ordering 2: orphan retirement gets the lock first. A concurrent Seller attach
# must wait for retirement to commit, then fail because retired provenance is no
# longer valid attachment authority.
psql "${DB_URL}" -v ON_ERROR_STOP=1 >"${CLAIM_LOG}" 2>&1 <<SQL &
begin;
set local role service_role;
select public.service_claim_product_media_orphan(
  '${ACTOR_ID}'::uuid,
  '${OBJECT_PATH}'
);
\! touch "$CLAIM_READY"
select pg_sleep(2);
commit;
SQL
CLAIM_PID=$!

wait_for_file "${CLAIM_READY}" "${CLAIM_LOG}"
set +e
psql "${DB_URL}" -v ON_ERROR_STOP=1 >"${REATTACH_LOG}" 2>&1 <<SQL
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '${ACTOR_ID}', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"${ACTOR_ID}","role":"authenticated","iss":"https://example.supabase.co/auth/v1"}',
  true
);
select public.seller_save_product_v3(
  null,
  'Lifecycle Race Retire Wins',
  'CI-only product that must not attach media after concurrent retirement wins.',
  'CI lifecycle race retire wins',
  'physical',
  32.00,
  null,
  null,
  null,
  '{}'::uuid[],
  array['${PUBLIC_URL}'],
  '[{"title":"Default","price":32,"trackInventory":true,"inventoryQuantity":2,"inventoryPolicy":"deny","requiresShipping":true,"isActive":true}]'::jsonb,
  true,
  false,
  true,
  true,
  100,
  null,
  18,
  array['ci-lifecycle-race'],
  array['ci-lifecycle-race']
);
commit;
SQL
REATTACH_STATUS=$?
set -e
wait "${CLAIM_PID}"

if ! grep -q "claimed" "${CLAIM_LOG}"; then
  echo "Retire-wins claim did not claim the orphan" >&2
  cat "${CLAIM_LOG}" >&2
  exit 1
fi

if [[ ${REATTACH_STATUS} -eq 0 ]]; then
  echo "Retire-wins race unexpectedly allowed a concurrent reattachment" >&2
  cat "${REATTACH_LOG}" >&2
  exit 1
fi

if ! grep -q "product_media_scan_provenance_required" "${REATTACH_LOG}"; then
  echo "Retire-wins reattachment failed for the wrong reason" >&2
  cat "${REATTACH_LOG}" >&2
  exit 1
fi

# Retirement itself is immutable. Even service-role application code cannot
# clear retired_at and resurrect an object after it has entered deletion state.
set +e
psql "${DB_URL}" -v ON_ERROR_STOP=1 >"${IMMUTABLE_LOG}" 2>&1 -c \
  "set role service_role; update public.upload_scan_jobs set retired_at = null where id = '${JOB_ID}'::uuid;"
IMMUTABLE_STATUS=$?
set -e

if [[ ${IMMUTABLE_STATUS} -eq 0 ]]; then
  echo "Retired product media was unexpectedly unretired" >&2
  exit 1
fi

if ! grep -q "product_media_retirement_is_immutable" "${IMMUTABLE_LOG}"; then
  echo "Retirement immutability failed for the wrong reason" >&2
  cat "${IMMUTABLE_LOG}" >&2
  exit 1
fi

psql "${DB_URL}" -v ON_ERROR_STOP=1 <<SQL
do \$\$
begin
  if exists (
    select 1
    from public.product_media pm
    where pm.url like '%/${OBJECT_PATH}'
  ) then
    raise exception 'race regression left a live catalogue reference to retired media';
  end if;

  if not exists (
    select 1
    from public.upload_scan_jobs j
    where j.id = '${JOB_ID}'::uuid
      and j.retired_at is not null
  ) then
    raise exception 'race regression did not persist retired scanner provenance';
  end if;
end
\$\$;
SQL

echo "Product-media two-session lifecycle race regression passed"
