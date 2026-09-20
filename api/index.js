const express = require("express");
const { addonBuilder, getRouter } = require("stremio-addon-sdk");

const app = express();

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
  
  // Scraper logic will go here
  return {
    streams: [
      {
        title: "VegaMovies - Test Stream",
        url: "https://distribution.bbb3d.renderfarming.net/video/mp4/bbb_sunflower_1080p_30fps_normal.mp4"
      }
    ]
  };
});

const addonInterface = builder.getInterface();
const router = getRouter(addonInterface);

// Use Stremio SDK Router inside Express
app.use("/", router);

module.exports = app;
