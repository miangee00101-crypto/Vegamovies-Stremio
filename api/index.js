const { addonBuilder, getRouter } = require('stremio-addon-sdk');
const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const VEGA_BASE = 'https://new2.vegamovies.futbol';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const manifest = {
  id: 'community.vegamovies',
  version: '1.0.2',
  name: 'VegaMovies',
  description: 'Streams from Vegamovies',
  resources: ['stream'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  catalogs: []
};

const builder = new addonBuilder(manifest);

// Simple search
async function searchVega(query) {
  try {
    const res = await fetch(`\( {VEGA_BASE}/?s= \){encodeURIComponent(query)}`, {
      headers: { 'User-Agent': USER_AGENT }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    const results = [];
    $('article, .post, .item, .movie-item').each((i, el) => {
      const a = $(el).find('a').first();
      const title = a.text().trim() || $(el).find('h2, h3').text().trim();
      let href = a.attr('href');
      if (title && href) {
        if (!href.startsWith('http')) href = VEGA_BASE + href;
        results.push({ title, link: href });
      }
    });
    return results;
  } catch (e) {
    console.error(e);
    return [];
  }
}

async function getLinks(pageUrl) {
  try {
    const res = await fetch(pageUrl, { headers: { 'User-Agent': USER_AGENT } });
    const html = await res.text();
    const $ = cheerio.load(html);
    const streams = [];
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim().substring(0, 50);
      if (href && href.startsWith('http') && (href.includes('download') || href.includes('fastdl') || href.includes('vcloud') || href.includes('drive') || href.includes('mediafire') || href.includes('gofile'))) {
        streams.push({
          name: `Vega • ${text || 'Link'}`,
          url: href
        });
      }
    });
    return streams;
  } catch (e) {
    return [];
  }
}

builder.defineStreamHandler(async ({ type, id }) => {
  let query = id;
  if (id.startsWith('tt')) {
    try {
      const r = await fetch(`https://v3-cinemeta.strem.io/meta/\( {type}/ \){id}.json`);
      const j = await r.json();
      if (j?.meta?.name) query = j.meta.name;
    } catch (e) {}
  }
  query = query.replace(/\s*\(\d{4}\)/, '').trim();

  const results = await searchVega(query);
  if (!results.length) return { streams: [] };

  const streams = await getLinks(results[0].link);
  streams.unshift({
    name: 'Open on VegaMovies',
    url: results[0].link,
    behaviorHints: { notWebReady: true }
  });

  return { streams };
});

// === Vercel + Express (this is the working pattern) ===
const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

app.use(getRouter(builder.getInterface()));

module.exports = app;
