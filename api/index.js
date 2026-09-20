const { addonBuilder } = require('stremio-addon-sdk');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

// === CONFIG ===
// Update this when the domain dies
const VEGA_BASE = 'https://new2.vegamovies.futbol'; // change when needed
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Manifest
const manifest = {
  id: 'community.vegamovies',
  version: '1.0.0',
  name: 'VegaMovies',
  description: 'Streams / download links from Vegamovies (self-hosted)',
  logo: 'https://via.placeholder.com/256x256.png?text=Vega',
  resources: ['stream'],
  types: ['movie', 'series'],
  idPrefixes: ['tt', 'vega'],
  catalogs: []
};

const builder = new addonBuilder(manifest);

// Helper: search Vegamovies by title
async function searchVega(query) {
  try {
    const url = `\( {VEGA_BASE}/?s= \){encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Referer': VEGA_BASE }
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    const results = [];
    // Adjust these selectors when the site layout changes
    $('.post-item, .item, article, .movie-item').each((i, el) => {
      const title = $(el).find('h2 a, h3 a, .title a, a').first().text().trim();
      const link = $(el).find('h2 a, h3 a, .title a, a').first().attr('href');
      const poster = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
      if (title && link) {
        results.push({ title, link: link.startsWith('http') ? link : VEGA_BASE + link, poster });
      }
    });
    return results;
  } catch (err) {
    console.error('Search error:', err.message);
    return [];
  }
}

// Helper: extract download / stream links from a movie page
async function getStreamsFromPage(pageUrl) {
  try {
    const res = await fetch(pageUrl, {
      headers: { 'User-Agent': USER_AGENT, 'Referer': VEGA_BASE }
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    const streams = [];

    // Common patterns on these sites – update as needed
    // 1. Direct download buttons / quality links
    $('a[href*="download"], a[href*="fastdl"], a[href*="vcloud"], a[href*="gofile"], a[href*="mediafire"], .download-links a, .btn-download, .quality a').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim() || $(el).attr('title') || 'Download';
      if (href && href.startsWith('http')) {
        streams.push({
          name: `Vega • ${text.substring(0, 40)}`,
          title: text,
          url: href,
          behaviorHints: { bingeGroup: 'vega' }
        });
      }
    });

    // 2. Sometimes they put links inside .entry-content or specific divs
    $('.entry-content a, .post-content a, .download a').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href && (href.includes('drive') || href.includes('mega') || href.includes('mediafire') || href.includes('fastdl') || href.includes('vcloud'))) {
        streams.push({
          name: `Vega • ${text || 'Link'}`,
          title: text || 'Download Link',
          url: href
        });
      }
    });

    // Deduplicate
    const unique = [];
    const seen = new Set();
    for (const s of streams) {
      if (!seen.has(s.url)) {
        seen.add(s.url);
        unique.push(s);
      }
    }
    return unique;
  } catch (err) {
    console.error('Page scrape error:', err.message);
    return [];
  }
}

// Stream handler
builder.defineStreamHandler(async ({ type, id }) => {
  // id can be ttXXXXXXX (IMDb) or a custom vega:slug
  let searchQuery = id;

  // If it's an IMDb id, you can optionally resolve the real title via Cinemeta / TMDB
  // For simplicity we just search with the id / cleaned name
  if (id.startsWith('tt')) {
    // Optional: fetch title from Cinemeta
    try {
      const metaRes = await fetch(`https://v3-cinemeta.strem.io/meta/\( {type}/ \){id}.json`);
      const meta = await metaRes.json();
      if (meta?.meta?.name) searchQuery = meta.meta.name;
    } catch (e) {}
  }

  // Clean year etc for better search
  searchQuery = searchQuery.replace(/\s*\(\d{4}\)/, '').trim();

  const results = await searchVega(searchQuery);
  if (!results.length) {
    return { streams: [] };
  }

  // Take the best matching result (first one)
  const best = results[0];
  const streams = await getStreamsFromPage(best.link);

  // Add a fallback "Open on site" stream if you want
  streams.unshift({
    name: 'VegaMovies Page',
    title: 'Open original page',
    url: best.link,
    behaviorHints: { notWebReady: true }
  });

  return { streams };
});

// Export for Vercel
module.exports = builder.getInterface();
