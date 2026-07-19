import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const url = String(process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!/^https:\/\/[^/]+\.supabase\.co$/.test(url)) throw new Error('Refusing backup: production Supabase URL not detected');
if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
const response = await fetch(`${url}/rest/v1/`, { headers });
if (!response.ok) throw new Error(`OpenAPI request failed: ${response.status}`);
const openApi = await response.json();
const tables = Object.keys(openApi.paths || {})
  .map((entry) => entry.replace(/^\//, ''))
  .filter((entry) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(entry));

const data = {};
const errors = [];
for (const table of tables) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await fetch(`${url}/rest/v1/${table}?select=*`, {
      headers: { ...headers, Range: `${offset}-${offset + 999}`, Prefer: 'count=exact' },
    });
    if (!page.ok) {
      errors.push({ table, status: page.status });
      break;
    }
    const chunk = await page.json();
    rows.push(...chunk);
    if (chunk.length < 1000) break;
  }
  if (!errors.some((entry) => entry.table === table)) data[table] = rows;
}

const authUsers = [];
for (let page = 1; ; page += 1) {
  const authPage = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers });
  if (!authPage.ok) {
    errors.push({ table: 'auth.users', status: authPage.status });
    break;
  }
  const payload = await authPage.json();
  const users = Array.isArray(payload.users) ? payload.users : [];
  authUsers.push(...users.map((user) => ({
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    created_at: user.created_at,
    updated_at: user.updated_at,
    confirmed_at: user.confirmed_at,
    last_sign_in_at: user.last_sign_in_at,
    user_metadata: user.user_metadata,
    app_metadata: user.app_metadata,
  })));
  if (users.length < 1000) break;
}

const storageObjects = [];
const storageRoot = path.resolve(process.cwd(), 'backups', 'production', 'storage');
const bucketResponse = await fetch(`${url}/storage/v1/bucket`, { headers });
if (!bucketResponse.ok) {
  errors.push({ table: 'storage.buckets', status: bucketResponse.status });
} else {
  const buckets = await bucketResponse.json();
  async function walkBucket(bucket, prefix = '') {
    const listing = await fetch(`${url}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } }),
    });
    if (!listing.ok) {
      errors.push({ table: `storage.${bucket}`, status: listing.status });
      return;
    }
    for (const entry of await listing.json()) {
      const objectPath = `${prefix}${entry.name}`;
      if (!entry.id) {
        await walkBucket(bucket, `${objectPath}/`);
        continue;
      }
      const objectResponse = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath.split('/').map(encodeURIComponent).join('/')}`, { headers });
      if (!objectResponse.ok) {
        errors.push({ table: `storage.${bucket}/${objectPath}`, status: objectResponse.status });
        continue;
      }
      const target = path.join(storageRoot, bucket, ...objectPath.split('/'));
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, Buffer.from(await objectResponse.arrayBuffer()));
      storageObjects.push({ bucket, path: objectPath, size: Number(entry.metadata?.size || 0), updated_at: entry.updated_at || null });
    }
  }
  for (const bucket of buckets) await walkBucket(bucket.name);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = path.resolve(process.cwd(), 'backups', 'production');
await fs.mkdir(outputDir, { recursive: true });
const outputPath = path.join(outputDir, `supabase-rest-${timestamp}.json`);
await fs.writeFile(outputPath, JSON.stringify({
  exported_at: new Date().toISOString(),
  project_host: new URL(url).host,
  tables: Object.fromEntries(Object.entries(data).map(([name, rows]) => [name, rows.length])),
  auth_user_count: authUsers.length,
  errors,
  auth_users: authUsers,
  storage_objects: storageObjects,
  data,
}, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ outputPath, tableCount: Object.keys(data).length, errors: errors.length }));
