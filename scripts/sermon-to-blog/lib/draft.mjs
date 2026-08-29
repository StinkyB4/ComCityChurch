/**
 * Turns a raw sermon transcript into a blog post in the site's house style.
 *
 * The markup rules below are lifted from blog/BLOG-FORMATTING-GUIDE.txt. The
 * output goes straight into blog_posts.content, which js/blog-public.js injects
 * as raw HTML inside the article container — so it must be a body fragment, and
 * it must not repeat the title (the page hero already renders it).
 */
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';

const PostSchema = z.object({
  title:    z.string().describe('Post title. Sentence-case, 3–8 words, no series numbering.'),
  slug:     z.string().describe('Lowercase URL slug, words separated by hyphens, no dates.'),
  category: z.string().describe('Short label shown as the eyebrow, e.g. "Sermon Reflection".'),
  excerpt:  z.string().describe('One or two sentences for the blog index card. Under 220 characters.'),
  content_html: z.string().describe('The post body as an HTML fragment following the house style.'),
});

const HOUSE_STYLE = `
You are writing for Commissioned City Church, a missional church in Winnipeg.
You turn a Sunday sermon transcript into a written blog post for the church website.

VOICE
- Write as the preacher, in first person plural where the sermon addresses the church
  ("we", "us", "our"), first person singular where he speaks personally ("I").
- Warm, plain, pastoral. Short sentences. No academic register, no marketing gloss.
- Keep the preacher's own images, stories and turns of phrase. You are editing spoken
  words into readable prose, not writing a fresh essay on the same topic.
- Cut filler, false starts, repeated run-ups and in-room asides ("turn with me",
  "as I said last week", greetings, announcements).
- Never invent an illustration, statistic, quotation or anecdote that is not in the
  transcript. If the transcript is unclear on a point, leave the point out.
- Scripture: quote only references the transcript actually cites. Keep the wording as
  the preacher read it.

STRUCTURE
- 700–1200 words. Three to five <h2> sections with real, specific headings.
- Open with a short paragraph that lands the sermon's central claim — not a preamble
  about the sermon existing.
- Close with the sermon's own application or send-out, not a generic exhortation.

MARKUP — output an HTML fragment only. No <html>, <head>, <body>, no <h1>, no
title repetition, no markdown, no code fences.
Every top-level element carries class="fade-in-up". Use only these forms:

  <h2 class="fade-in-up">Section Heading</h2>
  <h3 class="fade-in-up">Sub-Section Heading</h3>
  <p class="fade-in-up">Paragraph text.</p>

  <ul class="fade-in-up" style="line-height:2; color:var(--charcoal); padding-left:var(--space-lg);">
    <li>Item</li>
  </ul>

  <ol class="fade-in-up" style="color:var(--charcoal); line-height:1.8; padding-left:var(--space-lg);">
    <li>Item</li>
  </ol>

Scripture and pull quotes use exactly this block:

  <div class="fade-in-up" style="border-left:4px solid var(--red); padding:var(--space-md) var(--space-lg); background:var(--gray-bg); border-radius:0 var(--radius-card) var(--radius-card) 0; margin:var(--space-lg) 0;">
    <p style="font-style:italic; margin:0; color:var(--charcoal);">"Quote text."</p>
    <p style="font-size:13px; font-weight:600; color:var(--muted-blue); margin:8px 0 0;">— Reference (Book Chapter:Verse)</p>
  </div>

<strong> and <em> are fine inline. Do not use any other tag, and do not add
images — no image exists for this post yet.

End the fragment with this note, with the real date substituted:

  <p class="fade-in-up" style="font-size:14px; color:var(--muted-blue); font-style:italic;">Adapted from a sermon preached on {SERMON_DATE}.</p>
`.trim();

export async function draftPost({ transcript, sermonDate, durationMinutes }) {
  const client = new Anthropic();

  /* Structured outputs are a beta on @anthropic-ai/sdk 0.71, and its auto-parse
     helper still keys off the older top-level `output_format` param. Sending the
     current `output_config.format` shape and validating with Zod here keeps the
     request correct and the checking strict, independent of that helper. */
  const response = await client.beta.messages.create({
    model:      'claude-opus-5',
    max_tokens: 16000,
    betas:      ['structured-outputs-2025-11-13'],
    thinking:   { type: 'adaptive' },
    system: [
      {
        type: 'text',
        text: HOUSE_STYLE.replace('{SERMON_DATE}', sermonDate),
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content:
          `Transcript of a ${durationMinutes}-minute sermon preached on ${sermonDate}. ` +
          'It is machine-generated, so expect missing punctuation and the occasional ' +
          'misheard word — read through those rather than reproducing them.\n\n' +
          `<transcript>\n${transcript}\n</transcript>`,
      },
    ],
    output_config: { format: betaZodOutputFormat(PostSchema, 'blog_post') },
  });

  if (response.stop_reason === 'refusal') {
    throw new Error(
      `Claude declined to draft this post (${response.stop_details?.category ?? 'unspecified'}). ` +
      'The transcript is saved as a workflow artifact; draft this one by hand.'
    );
  }

  const text = response.content.find((block) => block.type === 'text')?.text;
  if (!text) {
    throw new Error('Claude returned no text block to draft the post from.');
  }

  return PostSchema.parse(JSON.parse(text));
}
