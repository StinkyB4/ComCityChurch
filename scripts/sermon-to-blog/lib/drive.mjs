/**
 * Google Drive access via a service account.
 *
 * Signs its own JWT with node:crypto rather than pulling in googleapis — the
 * job needs exactly two Drive calls (list, download) and one token exchange.
 */
import crypto from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE     = 'https://www.googleapis.com/auth/drive.readonly';

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

/** Exchange the service-account key for a short-lived OAuth access token. */
async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim  = b64url(JSON.stringify({
    iss:   serviceAccount.client_email,
    scope: SCOPE,
    aud:   TOKEN_URL,
    iat:   now,
    exp:   now + 3600,
  }));

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const signature = signer.sign(serviceAccount.private_key, 'base64url');
  const assertion = `${header}.${claim}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!res.ok) {
    throw new Error(`Google token exchange failed (${res.status}): ${await res.text()}`);
  }

  return (await res.json()).access_token;
}

/**
 * Newest-first list of audio/video files in the sermon folder.
 * Shared-drive flags are always on — a folder shared *with* the service
 * account and a folder *inside* a shared drive behave differently otherwise.
 */
export async function listRecordings(serviceAccount, folderId) {
  const token = await getAccessToken(serviceAccount);

  const query = [
    `'${folderId}' in parents`,
    'trashed = false',
    "(mimeType contains 'audio/' or mimeType contains 'video/')",
  ].join(' and ');

  const params = new URLSearchParams({
    q:                         query,
    fields:                    'files(id,name,mimeType,size,createdTime)',
    orderBy:                   'createdTime desc',
    pageSize:                  '25',
    supportsAllDrives:         'true',
    includeItemsFromAllDrives: 'true',
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Drive list failed (${res.status}): ${await res.text()}`);
  }

  return (await res.json()).files || [];
}

/** Fetch one file's bytes. */
export async function downloadFile(serviceAccount, fileId) {
  const token  = await getAccessToken(serviceAccount);
  const params = new URLSearchParams({ alt: 'media', supportsAllDrives: 'true' });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Drive download failed (${res.status}): ${await res.text()}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

/** Metadata for a single file, used by the manual `file_id` run. */
export async function getFile(serviceAccount, fileId) {
  const token  = await getAccessToken(serviceAccount);
  const params = new URLSearchParams({
    fields:            'id,name,mimeType,size,createdTime',
    supportsAllDrives: 'true',
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Drive metadata failed (${res.status}): ${await res.text()}`);
  }

  return res.json();
}
