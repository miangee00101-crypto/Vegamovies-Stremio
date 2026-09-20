const { addonBuilder } = require("stremio-addon-sdk");

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
  
  // Stream scraping logic will go here
  const streams = [
    {
      title: "VegaMovies - 1080p [Test Stream]",
      url: "https://distribution.bbb3d.renderfarming.net/video/mp4/bbb_sunflower_1080p_30fps_normal.mp4"
    }
  ];

  return Promise.resolve({ streams });
});

const addonInterface = builder.getInterface();

module.exports = (req, res) => {
  // Add CORS headers so Stremio can access the endpoint
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.url === "/" || req.url === "/manifest.json") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(addonInterface.manifest));
  } else if (req.url.startsWith("/stream/")) {
    // Route stream handler requests
    const pathParts = req.url.replace(".json", "").split("/");
    const type = pathParts[2];
    const id = pathParts[3];

    addonInterface.get("stream", type, id, (err, resObj) => {
      if (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      } else {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(resObj));
      }
    });
  } else {
    res.statusCode = 404;
    res.end("Not Found")
      ;
