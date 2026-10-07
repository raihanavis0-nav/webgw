const admin = require("../../server/thoughts-admin");
const site = require("../../server/site-admin");

function bodyObject(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch (_) {
    return {};
  }
}

function validRating(value) {
  const text = String(value || "");
  if (text === "N/R") return true;
  const number = Number(text);
  return (
    Number.isFinite(number) &&
    number >= 0.5 &&
    number <= 5 &&
    Math.round(number * 2) === number * 2
  );
}

function cleanPaths(value) {
  if (!Array.isArray(value) || !value.length || value.length > 30) return null;
  const paths = value.map(site.safeImagePath);
  if (paths.some(function (path) { return !path; })) return null;
  return paths;
}

module.exports = async function handler(req, res) {
  admin.noStore(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!admin.requireSameOrigin(req, res)) return;
  if (!admin.requireSession(req, res)) return;

  const body = bodyObject(req);
  const action = String(body.action || "");

  try {
    const current = await site.getDataSource();
    let next = current.text;
    let message = "content: update portfolio";

    if (action === "addFilm") {
      const title = String(body.title || "").trim().slice(0, 200);
      const rating = String(body.rating || "N/R");

      if (!title || !validRating(rating)) {
        return res.status(400).json({ error: "Invalid film title or rating." });
      }

      const entry =
        rating === "N/R" ? title + " (N/R)" : title + " (" + rating + "/5)";
      next = site.addFilm(next, entry);
      message = 'content: add film "' + title + '"';

      await site.writeDataSource(next, current.sha, message);
      return res.status(200).json({ ok: true, entry });
    }

    if (action === "newAlbum") {
      const name = String(body.name || "").trim().slice(0, 120);
      const paths = cleanPaths(body.paths);

      if (!name || !paths) {
        return res.status(400).json({ error: "Invalid album data." });
      }

      next = site.addNewAlbum(next, { name, paths });
      message = 'content: add album "' + name + '"';
      await site.writeDataSource(next, current.sha, message);
      return res.status(200).json({ ok: true });
    }

    if (action === "addAlbumImages") {
      const albumName = String(body.albumName || "").trim().slice(0, 120);
      const paths = cleanPaths(body.paths);

      if (!albumName || !paths) {
        return res.status(400).json({ error: "Invalid album update." });
      }

      next = site.addImagesToAlbum(next, albumName, paths);
      message =
        'content: add ' + paths.length + ' image(s) to "' + albumName + '"';
      await site.writeDataSource(next, current.sha, message);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Unknown action." });
  } catch (error) {
    console.error("Portfolio admin content API:", error);

    if (error && (error.status === 409 || error.status === 422)) {
      return res.status(409).json({
        error: "The site changed while you were editing. Refresh and try again.",
      });
    }

    return res.status(502).json({
      error: error && error.message ? error.message : "Could not update the site.",
    });
  }
};
