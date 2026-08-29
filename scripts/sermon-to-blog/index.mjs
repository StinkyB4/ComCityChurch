/**
 * SERMON → BLOG
 * =============
 * Runs weekly from .github/workflows/sermon-to-blog.yml.
 *
 *   Google Drive folder  →  newest unprocessed recording
 *                        →  Azure AI Speech transcript
 *                        →  Claude draft in the site's house style
 *                        →  blog_posts row in Supabase (status: draft)
 *
 * The post lands as a draft, so nothing reaches the public site until it is
 * approved in the member portal (Dashboard → Blog).
 */
import fs from 'node:fs';
import { loadEnv }                          from './lib/env.mjs';
import { listRecordings, getFile, downloadFile } from './lib/drive.mjs';
import { transcribe }                       from './lib/transcribe.mjs';
import { draftPost }                        from './lib/draft.mjs';
import { findBySourceFile, uniqueSlug, insertPost } from './lib/supabase.mjs';

/** Sunday on or before the recording's upload date — the day it was preached. */
function sermonDateFrom(createdTime) {
  const d = new Date(createdTime);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

function humanDate(iso) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
}

function summary(lines) {
  console.log(lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
  }
}

/** The newest recording that has not already produced a post. */
async function pickRecording(env) {
  if (env.forceFileId) {
    return getFile(env.googleServiceAccount, env.forceFileId);
  }

  const files = await listRecordings(env.googleServiceAccount, env.driveFolderId);
  if (!files.length) return null;

  for (const file of files) {
    if (!(await findBySourceFile(env, file.id))) return file;
  }

  return null;
}

async function main() {
  const env  = loadEnv();
  const file = await pickRecording(env);

  if (!file) {
    summary(['### Sermon → blog', '', 'No new recording in the Drive folder. Nothing to do.']);
    return;
  }

  const existing = await findBySourceFile(env, file.id);
  if (existing) {
    summary([
      '### Sermon → blog', '',
      `\`${file.name}\` already has a post (\`${existing.slug}\`, ${existing.status}). Skipping.`,
    ]);
    return;
  }

  const sermonDate = sermonDateFrom(file.createdTime);
  console.log(`Processing "${file.name}" (${file.id}), preached ${sermonDate}`);

  const audio = await downloadFile(env.googleServiceAccount, file.id);
  console.log(`Downloaded ${(audio.length / 1024 / 1024).toFixed(1)} MB`);

  const { text: transcript, durationMinutes } = await transcribe({
    key:      env.speechKey,
    region:   env.speechRegion,
    locale:   env.speechLocale,
    audio,
    filename: file.name,
  });
  console.log(`Transcribed ${durationMinutes} min — ${transcript.length} characters`);

  /* Kept as a workflow artifact so a bad draft can be rewritten without
     re-running transcription, and so the raw text never lands in a public table. */
  fs.writeFileSync('transcript.txt', transcript);

  const draft = await draftPost({
    transcript,
    sermonDate: humanDate(sermonDate),
    durationMinutes,
  });

  const slug = await uniqueSlug(env, draft.slug);

  const post = await insertPost(env, {
    author_id:      env.authorId,
    author_name:    env.authorName,
    title:          draft.title,
    slug,
    category:       draft.category || 'Sermon Reflection',
    excerpt:        draft.excerpt,
    content:        draft.content_html,
    status:         env.postStatus,
    publish_at:     `${sermonDate}T12:00:00Z`,
    source_file_id: file.id,
    admin_note:     `Drafted from "${file.name}" (${durationMinutes} min, preached ${sermonDate}).`,
  });

  summary([
    '### Sermon → blog', '',
    `**${post.title}**`, '',
    `- Source: \`${file.name}\` — ${durationMinutes} min, preached ${humanDate(sermonDate)}`,
    `- Status: **${post.status}** — review it at https://commissionedcity.church/members/dashboard`,
    `- Preview: https://commissionedcity.church/blog/post.html?slug=${post.slug}&preview=1`,
    '',
    'The transcript is attached to this run as an artifact.',
  ]);
}

main().catch((err) => {
  console.error(err);
  summary(['### Sermon → blog failed', '', '```', String(err.message || err), '```']);
  process.exit(1);
});
