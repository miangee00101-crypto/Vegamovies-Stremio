const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const { addonBuilder, getRouter } = require("stremio-addon-sdk");

const app = express();

const VEGAMOVIES_BASE = "https://vegamovies.pages.dev"; // Primary/Active redirect domain

const manifest = {
  id: "org.vegamovies.addon",
  version: "1.0.0",
  name: "VegaMovies Scraper",
  description: "Fetches streams directly from VegaMovies",
  resources: ["stream"],
  types: ["movie", "series"],
  idPrefixes: ["tt"]
};

const builder = new addonBuilder(manifest);

// Helper function to resolve IMDb ID to Movie Title via Cinemeta
async function getTitleFromIMDb(id) {
  try {
    const res = await axios.get(`https://v3-cinemeta.strem.fun/meta/movie/${id}.json`);
    return res.data?.meta?.name || null;
  } catch (err) {
    console.error("Failed to fetch meta from Cinemeta:", err.message);
    return null;
  }
}

// Scrapes search page and returns post link
async function searchVegaMovies(query) {
  try {
    const searchUrl = `${VEGAMOVIES_BASE}/?s=${encodeURIComponent(query)}`;
    const { data } = await axios.get(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });

    const $ = cheerio.load(data);
    const firstResult = $("article.post-item a").first().attr("href") || 
                        $("h2.entry-title a").first().attr("href");

    return firstResult || null;
  } catch (err) {
    console.error("Search error:", err.message);
    return null;
  }
}

// Scrapes the target post for stream links
async function extractStreamsFromPost(postUrl) {
  try {
    const { data } = await axios.get(postUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });

    const $ = cheerio.load(data);
    const streams = [];

    // Finds download/stream buttons on the post
    $("a.maxbutton, a[href*='hubcloud'], a[href*='vcloud']").each((i, el) => {
      const link = $(el).attr("href");
      const label = $(el).text().trim() || "VegaMovies Stream";

      if (link) {
        streams.push({
          title: `VegaMovies - ${label}`,
          url: link
        });
      }
    });

    return streams;
  } catch (err) {
    console.error("Post extraction error:", err.message);
    return [];
  }
}

// Main Stremio Stream Handler
builder.defineStreamHandler(async ({ type, id }) => {
  console.log(`Stream requested for ${type} with ID: ${id}`);

  // 1. Convert IMDb ID to title
  const title = await getTitleFromIMDb(id);
  if (!title) return { streams: [] };

  console.log(`Searching VegaMovies for title: ${title}`);

  // 2. Search VegaMovies for the title
  const postUrl = await searchVegaMovies(title);
  if (!postUrl) return { streams: [] };

  // 3. Extract stream landing links
  const streams = await extractStreamsFromPost(postUrl);

  return { streams };
});

const addonInterface = builder.getInterface();
const router = getRouter(addonInterface);

app.use("/", router);

module.exports = app;
