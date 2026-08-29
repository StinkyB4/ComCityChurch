# Sermon → Blog Draft

Turns Sunday's recording into a reviewable blog post, with no steps in between.

```
Google Drive folder ──▶ Azure AI Speech ──▶ Claude ──▶ Supabase blog_posts
   (you upload)          (transcript)      (draft)      (status: draft)
```

The job runs from `.github/workflows/sermon-to-blog.yml` every **Tuesday at
12:00 UTC** (7am CDT / 6am CST in Winnipeg) and can also be run by hand from the
Actions tab. From your side the whole workflow is: upload the recording to Drive
by Monday evening, then approve the draft in the member portal on Tuesday.

Nothing publishes itself. The post is created as a **draft**, so it appears in
Dashboard → Blog for editing, and goes live only when you publish it.

---

## One-time setup

### 1. Database

Run `sql/migrate_blog_posts_sermon_source.sql` in the Supabase SQL editor. It
adds `blog_posts.source_file_id`, which is how the job knows a recording has
already been drafted — that column is what makes re-runs safe.

### 2. Google Drive access

1. In the [Google Cloud console](https://console.cloud.google.com), create a
   project and enable the **Google Drive API**.
2. Create a **service account**, then a **JSON key** for it. Download the file.
3. Copy the service account's email (`...@....iam.gserviceaccount.com`) and
   share the sermon Drive folder with it as **Viewer**.
4. Open the folder in Drive and copy the folder ID from the URL:
   `https://drive.google.com/drive/folders/`**`<this part>`**

The service account only ever gets read access to that one folder.

### 3. Azure AI Speech

1. In the Azure portal create a **Speech service** resource (the free `F0` tier
   covers 5 audio hours a month, which is more than enough for one sermon a week).
2. Copy **Key 1** and the **Location/Region** short name (e.g. `canadacentral`).

This uses the *fast transcription* API, which takes the audio file directly in
the request — so there is no storage account and no SAS token to manage. Its
limits are 300 MB and 2 hours per file.

### 4. Supabase service key

Supabase → Project Settings → API → **`service_role`** key. This key bypasses
row level security, which is why it lives only in GitHub Actions secrets and is
never referenced by anything in the browser.

### 5. Author identity

The post needs an author. In Supabase → Authentication → Users, copy the UUID of
your own account — that becomes `BLOG_AUTHOR_ID`.

### 6. Repository secrets

Settings → Secrets and variables → Actions → **New repository secret**:

| Secret | Value |
| --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Entire contents of the downloaded JSON key file |
| `GDRIVE_SERMON_FOLDER_ID` | The Drive folder ID from step 2 |
| `AZURE_SPEECH_KEY` | Key 1 from the Speech resource |
| `AZURE_SPEECH_REGION` | Region short name, e.g. `canadacentral` |
| `ANTHROPIC_API_KEY` | From console.anthropic.com |
| `SUPABASE_URL` | `https://lkmphayrithxkmhvfiep.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | The `service_role` key from step 4 |
| `BLOG_AUTHOR_ID` | Your Supabase user UUID |
| `BLOG_AUTHOR_NAME` | e.g. `Brennan Cattani` |

---

## First run

Don't wait for Tuesday. Actions → **Sermon → Blog Draft** → *Run workflow*,
leaving both inputs blank. It picks the newest recording in the folder that
hasn't been drafted yet.

The run summary links straight to the preview URL and the dashboard. The
transcript is attached to the run as an artifact for 90 days, so if a draft
comes out wrong you can rewrite it without paying for transcription again.

## Running it against one specific recording

Use *Run workflow* and paste a Drive file ID into `file_id` — useful for
backfilling older sermons. Each file is drafted at most once; running it twice
on the same recording reports the existing post and stops.

---

## Where things live

| File | Does |
| --- | --- |
| `index.mjs` | Picks the recording, runs the four steps, writes the run summary |
| `lib/drive.mjs` | Service-account JWT, folder listing, file download |
| `lib/transcribe.mjs` | Azure fast transcription |
| `lib/draft.mjs` | Claude call — house style lives in `HOUSE_STYLE` here |
| `lib/supabase.mjs` | Duplicate check, slug collisions, insert |
| `lib/env.mjs` | Secret validation |

**To change how the posts read**, edit `HOUSE_STYLE` in `lib/draft.mjs`. That
string holds the voice rules and the markup vocabulary, and it is deliberately
the only place either is described — the markup rules mirror
`blog/BLOG-FORMATTING-GUIDE.txt`, so if you change the site's conventions,
change both.

## Costs

At one 40-minute sermon a week: Azure Speech is free on the F0 tier (5 hrs/mo),
GitHub Actions is free on public repositories, and the Claude call is a few
cents per post. The Azure nonprofit credits are not really needed here — the
free tiers cover this workload.

## Things that will eventually bite

- **`AZURE_SPEECH_LOCALE`** defaults to `en-CA`. Set it as a repository variable
  if you want a different dialect.
- **Recording length.** Fast transcription caps at 2 hours and 300 MB. A long
  service recording (rather than just the sermon) can exceed the size cap; the
  job fails with a clear message rather than silently truncating.
- **The `api-version` in `lib/transcribe.mjs`** is pinned to `2024-11-15`.
  Azure ships changes under new versions, so this keeps working — but check the
  response shape before bumping it.
