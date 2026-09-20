const { addonBuilder, getRouter } = require('stremio-addon-sdk');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

// ========== CONFIG ==========
const VEGA_BASE = 'https://new2.vegamovies.futbol'; // change when domain dies
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ========== MANIFEST ==========
const manifest = {
  id: 'community.vegamovies',
  version: '1.0.1',
  name: 'VegaMovies',
  description: 'Streams / download links from Vegamovies',
  logo: 'https://via.placeholder.com/256x256.png?text=Vega',
  resources: ['stream'],
  types: ['movie', 'series'],
  idPrefixes: ['tt', 'vega'],
  catalogs: []
};

const builder = new addonBuilder(manifest);

// ========== HELPERS ==========
async function searchVega(query) {
  try {
    const url = `\( {VEGA_BASE}/?s= \){encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Referer: VEGA_BASE }
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);

    const results = [];
    $('.post-item, .item, article, .movie-item, .post').each((i, el) => {
      const a = $(el).find('h2 a, h3 a, .title a, a').first();
      const title = a.text().trim();
      let link = a.attr('href');
      const poster = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
      if (title && link) {
        if (!link.startsWith('http')) link = VEGA_BASE + link;
        results.push({ title, link, poster });
      }
    });
    return results;
  } catch (err) {
    console.error('Search error:', err.message);
    return [];
  }
}

async function getStreamsFromPage(pageUrl) {
  try {
    const res = await fetch(pageUrl, {
      headers: { 'User-Agent': USER_AGENT, Referer: VEGA_BASE }
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);

    const streams = [];

    // Collect possible download / quality links
    $('a[href*="download"], a[href*="fastdl"], a[href*="vcloud"], a[href*="gofile"], a[href*="mediafire"], a[href*="drive"], .download-links a, .btn-download, .quality a, .entry-content a, .post-content a').each((i, el) => {
      const href = $(el).attr('href');
      const text = ($(el).text() || $(el).attr('title') || 'Link').trim().substring(0, 60);
      if (href && href.startsWith('http')) {
        streams.push({
          name: `Vega • ${text}`,
          title: text,
          url: href,
          behaviorHints: { bingeGroup: 'vega' }
        });
      }
    });

    // Deduplicate
    const seen = new Set();
    return streams.filter(s => {
      if (seen.has(s.url)) return false;
      seen.add(s.url);
      return true;
    });
  } catch (err) {
    console.error('Page scrape error:', err.message);
    return [];
  }
}

// ========== STREAM HANDLER ==========
builder.defineStreamHandler(async ({ type, id }) => {
  let searchQuery = id;

  // Try to get real title from Cinemeta when it's an IMDb id
  if (id.startsWith('tt')) {
    try {
      const metaRes = await fetch(`https://v3-cinemeta.strem.io/meta/\( {type}/ \){id}.json`);
      const metaJson = await metaRes.json();
      if (metaJson?.meta?.name) {
        searchQuery = metaJson.meta.name;
      }
    } catch (e) {}
  }

  // Clean year for better matching
  searchQuery = searchQuery.replace(/\s*\(\d{4}\)/, '').trim();

  const results = await searchVega(searchQuery);
  if (!results.length) {
    return { streams: [] };
  }

  const best = results[0];
  const streams = await getStreamsFromPage(best.link);

  // Always put the original page first as fallback
  streams.unshift({
    name: 'VegaMovies Page',
    title: 'Open original page',
    url: best.link,
    behaviorHints: { notWebReady: true }
  });

  return { streams };
});

// ========== VERCEL HANDLER (THIS WAS MISSING) ==========
const addonInterface = builder.getInterface();
const router = getRouter(addonInterface);

module.exports = (req, res) => {
  // CORS (important for Stremio)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return router(req, res);
};
