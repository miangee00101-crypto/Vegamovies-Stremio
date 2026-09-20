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
  
  // Scraper logic will be added here
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

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Content-Type", "application/json");

  const url = req.url || "/";

  // Handle Root and Manifest requests
  if (url === "/" || url === "/manifest.json") {
    return res.status(200).send(addonInterface.manifest);
  }

  // Handle Stream requests: /stream/:type/:id.json
  if (url.startsWith("/stream/")) {
    try {
      const cleanUrl = url.replace(".json", "");
      const parts = cleanUrl.split("/").filter(Boolean); // ['stream', 'movie', 'tt12345']
      const type = parts[1];
      const id = parts[2];

      const streamResult = await addonInterface.get("stream", type, id);
      return res.status(200).send(streamResult || { streams: [] });
    } catch (err) {
      console.error("Stream handler error:", err);
      return res.status(500).send({ error: err.message, streams: [] });
    }
  }

  return res.status(404).send({ error: "Not Foun
    d" });
};
