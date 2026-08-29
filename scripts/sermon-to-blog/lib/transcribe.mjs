/**
 * Azure AI Speech — fast transcription.
 *
 * The batch transcription API wants a publicly reachable audio URL, which would
 * mean standing up a storage account and minting SAS tokens. Fast transcription
 * takes the file in the request body instead, so the recording never leaves the
 * runner except to go straight to Azure. Limits: 300 MB, 2 hours of audio.
 */

/* Pinned deliberately. Azure adds features under new api-versions rather than
   changing this one; bump it only after re-reading the response shape. */
const API_VERSION = '2024-11-15';

const MAX_BYTES = 300 * 1024 * 1024;

export async function transcribe({ key, region, locale, audio, filename }) {
  if (audio.length > MAX_BYTES) {
    throw new Error(
      `Recording is ${(audio.length / 1024 / 1024).toFixed(0)} MB; ` +
      'Azure fast transcription accepts at most 300 MB. ' +
      'Export the sermon as mono 64 kbps MP3, or switch this step to batch transcription.'
    );
  }

  const form = new FormData();
  form.append('audio', new Blob([audio]), filename);
  form.append('definition', JSON.stringify({
    locales:             [locale],
    profanityFilterMode: 'None',
  }));

  const url = `https://${region}.api.cognitive.microsoft.com` +
              `/speechtotext/transcriptions:transcribe?api-version=${API_VERSION}`;

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Ocp-Apim-Subscription-Key': key },
    body:    form,
  });

  if (!res.ok) {
    throw new Error(`Azure Speech failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  const text = (data.combinedPhrases || []).map((p) => p.text).join('\n\n').trim();

  if (!text) {
    throw new Error('Azure Speech returned no text. Check that the recording has audible speech.');
  }

  return {
    text,
    durationMinutes: Math.round((data.durationMilliseconds || 0) / 60000),
  };
}
