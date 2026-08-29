/**
 * Reads and validates the environment the job needs, so a missing secret
 * fails on line one with a clear name instead of somewhere deep in an API call.
 */

const REQUIRED = [
  'GOOGLE_SERVICE_ACCOUNT_JSON',
  'GDRIVE_SERMON_FOLDER_ID',
  'AZURE_SPEECH_KEY',
  'AZURE_SPEECH_REGION',
  'ANTHROPIC_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'BLOG_AUTHOR_ID',
  'BLOG_AUTHOR_NAME',
];

export function loadEnv() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `Missing required secret(s): ${missing.join(', ')}.\n` +
      'Add them under Settings → Secrets and variables → Actions in this repository.'
    );
  }

  return {
    googleServiceAccount: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    driveFolderId:        process.env.GDRIVE_SERMON_FOLDER_ID,
    speechKey:            process.env.AZURE_SPEECH_KEY,
    speechRegion:         process.env.AZURE_SPEECH_REGION,
    speechLocale:         process.env.AZURE_SPEECH_LOCALE || 'en-CA',
    supabaseUrl:          process.env.SUPABASE_URL.replace(/\/+$/, ''),
    supabaseKey:          process.env.SUPABASE_SERVICE_ROLE_KEY,
    authorId:             process.env.BLOG_AUTHOR_ID,
    authorName:           process.env.BLOG_AUTHOR_NAME,
    /* Which file to process. Empty means "newest unprocessed file in the folder". */
    forceFileId:          process.env.SERMON_FILE_ID || '',
    /* Posts land as drafts by default so they are reviewed before going live. */
    postStatus:           process.env.BLOG_POST_STATUS || 'draft',
  };
}
