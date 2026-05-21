const https = require('https');

const RSS_URL = 'https://anchor.fm/s/fcef7890/podcast/rss';
const COUNT   = 4;

module.exports = async function (context, req) {

  try {
    const xml   = await fetchURL(RSS_URL);
    const items = parseRSS(xml, COUNT);

    context.res = {
      status: 200,
      headers: {
        'Content-Type':                'application/json',
        'Cache-Control':               'public, max-age=900', // cache 15 min
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ status: 'ok', items })
    };

  } catch (err) {
    context.log.error('Sermon RSS fetch failed:', err.message);
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'error', message: err.message })
    };
  }
};

// ── HTTP fetch with redirect following (no npm packages needed) ────────────

function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CommissionedCityChurch/1.0)',
        'Accept':     'application/rss+xml, application/xml, text/xml, */*',
      }
    };

    https.get(url, options, (res) => {
      // Follow redirects — Spotify/Anchor redirects frequently
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchURL(res.headers.location).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} from RSS feed`));
      }

      let data = '';
      res.setEncoding('utf8');
      res.on('data',  chunk => { data += chunk; });
      res.on('end',   ()    => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ── RSS parser (regex-based — no xml package needed) ──────────────────────

function parseRSS(xml, count) {
  const items     = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && items.length < count) {
    const block = match[1];

    const title   = extractTag(block, 'title');
    const pubDate = extractTag(block, 'pubDate');
    const link    = extractTag(block, 'link') || extractTag(block, 'guid');
    const desc    = extractTag(block, 'description');

    // itunes:image href="..."
    const imageMatch = block.match(/<itunes:image[^>]+href=["']([^"']+)["']/i);
    const thumbnail  = imageMatch ? imageMatch[1] : '';

    items.push({
      title:       cleanCDATA(title),
      pubDate,
      link:        cleanCDATA(link),
      description: cleanCDATA(desc),
      thumbnail,
    });
  }

  return items;
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

function cleanCDATA(str) {
  return str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}
