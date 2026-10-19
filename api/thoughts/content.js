const reader = require("../../server/thoughts-public");
const store = require("../../server/thoughts-store");

function normalize(data) {
  const source = data && typeof data === "object" ? data : {};
  const stories = Array.isArray(source.stories) ? source.stories : [];

  return {
    schemaVersion: source.schemaVersion || 3,
    appearance: source.appearance && typeof source.appearance === "object" ? source.appearance : {},
    series: Array.isArray(source.series) ? source.series : [],
    subseries: Array.isArray(source.subseries) ? source.subseries : [],
    characters: Array.isArray(source.characters) ? source.characters : [],
    stories: stories.filter(function (story) {
      return story && story.published !== false;
    }),
    worldEntries: Array.isArray(source.worldEntries) ? source.worldEntries : [],
    galleryItems: Array.isArray(source.galleryItems) ? source.galleryItems : [],
  };
}

module.exports = async function handler(req, res) {
  reader.noStore(res);
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  if (!reader.requireSession(req, res)) return;
  if (req.method === "POST" && !reader.requireSameOrigin(req, res)) return;

  const ratingRequest = req.method === "POST" ||
    (req.query && req.query.ratings === "1");
  if (!ratingRequest) {
    try {
      const library = await store.readPublicLibrary();
      return res.status(200).json({ data: normalize(library.data) });
    } catch (error) {
      console.error("Protected stories content:", error);
      return res.status(502).json({ error: "Could not load stories." });
    }
  }

  const ratings = require("../../server/thoughts-ratings");
  const vote = req.method === "POST" ? ratings.parseVote(req.body) : null;
  if (req.method === "POST" && !vote) {
    return res.status(400).json({ error: "Invalid book rating." });
  }
  if (!ratings.configured()) {
    if (req.method === "GET") return res.status(200).json({ available: false, books: {} });
    return res.status(503).json({ error: "Community ratings are not configured." });
  }
  try {
    const library = await store.readPublicLibrary();
    const series = Array.isArray(library.data.series) ? library.data.series : [];
    if (req.method === "GET") {
      return res.status(200).json(await ratings.summaries(series));
    }
    if (!series.some(item => item && item.id === vote.seriesId)) {
      return res.status(404).json({ error: "This book no longer exists." });
    }
    const summary = await ratings.vote(vote, req);
    return res.status(200).json({ summary });
  } catch (error) {
    if (error.status === 429) {
      res.setHeader("Retry-After", String(error.retryAfter || 60));
      return res.status(429).json({ error: "Too many ratings. Please try later." });
    }
    console.error("Community book ratings:", error);
    return res.status(502).json({ error: "Community ratings are temporarily unavailable." });
  }
};
