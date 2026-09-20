const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const axios = require("axios");
const cheerio = require("cheerio");

const manifest = {
  id: "org.vegamovies.addon",
  version: "1.0.0",
  name: "VegaMovies Scraper",
  description: "Fetches streams directly from VegaMovies hosts",
  resources: ["stream"],
  types: ["movie", "series"],
  idPrefixes: ["tt"]
};

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async ({ type, id }) => {
  console.log(`Stream requested for ${type} with ID: ${id}`);
  
  // Scraper & bypass logic goes here
  const streams = [
    {
      title: "VegaMovies - 1080p [Fast Server]",
      url: "https://example-direct-stream-link.mp4"
    }
  ];

  return Promise.resolve({ streams });
});

// Koyeb injects a PORT environment variable dynamically (usually 8080)
const port = process.env.PORT || 7000;

serveHTTP(builder.getInterface(), { port: port }).then(({ url }) => {
  console.log(`Addon active at: ${url}`)
    ;
});
