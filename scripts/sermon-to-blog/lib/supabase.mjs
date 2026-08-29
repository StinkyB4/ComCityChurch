/**
 * Supabase REST access using the service_role key.
 *
 * service_role bypasses row level security, which is why this key must never
 * reach the browser — it lives only in GitHub Actions secrets and is read here.
 */

function headers(key, extra = {}) {
  return {
    apikey:          key,
    Authorization:   `Bearer ${key}`,
    'Content-Type':  'application/json',
    ...extra,
  };
}

async function request(env, path, init = {}) {
  const res = await fetch(`${env.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: headers(env.supabaseKey, init.headers),
  });

  if (!res.ok) {
    throw new Error(`Supabase ${init.method || 'GET'} ${path} failed (${res.status}): ${await res.text()}`);
  }

  return res.status === 204 ? null : res.json();
}

/** Has this recording already been drafted? Keeps re-runs from duplicating posts. */
export async function findBySourceFile(env, fileId) {
  const rows = await request(
    env,
    `blog_posts?select=id,slug,status&source_file_id=eq.${encodeURIComponent(fileId)}&limit=1`
  );
  return rows[0] || null;
}

/** Slugs are unique in the schema, so settle collisions before inserting. */
export async function uniqueSlug(env, slug) {
  const base = slug.replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'sermon';

  for (let n = 1; n < 25; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const rows = await request(
      env,
      `blog_posts?select=id&slug=eq.${encodeURIComponent(candidate)}&limit=1`
    );
    if (!rows.length) return candidate;
  }

  return `${base}-${Date.now()}`;
}

export async function insertPost(env, post) {
  const rows = await request(env, 'blog_posts', {
    method:  'POST',
    headers: { Prefer: 'return=representation' },
    body:    JSON.stringify([post]),
  });
  return rows[0];
}
