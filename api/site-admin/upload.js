const admin = require("../../server/thoughts-admin");
const site = require("../../server/site-admin");

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ["webp", "jpg", "jpeg", "png"];

function bodyObject(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch (_) {
    return {};
  }
}

function decodeBase64(value) {
  const content = String(value || "").replace(/\s+/g, "");
  if (!content || !/^[A-Za-z0-9+/=]+$/.test(content)) return null;

  const maxBase64Length = Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 16;
  if (content.length > maxBase64Length) return null;

  try {
    const buffer = Buffer.from(content, "base64");
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return null;
    return { content, buffer };
  } catch (_) {
    return null;
  }
}

function matchesType(buffer, extension) {
  if (!buffer || buffer.length < 12) return false;

  if (extension === "jpg" || extension === "jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (extension === "png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  if (extension === "webp") {
    return (
      buffer.slice(0, 4).toString("ascii") === "RIFF" &&
      buffer.slice(8, 12).toString("ascii") === "WEBP"
    );
  }

  return false;
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
  const extension = String(body.extension || "").toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return res.status(400).json({ error: "Unsupported image type." });
  }

  const decoded = decodeBase64(body.content);
  if (!decoded) {
    return res.status(413).json({
      error: "Image is too large or invalid. Keep it under 3 MB.",
    });
  }

  if (!matchesType(decoded.buffer, extension)) {
    return res.status(400).json({
      error: "The uploaded file does not match its image type.",
    });
  }

  const path = site.uniqueImagePath(
    body.folder,
    body.baseName,
    body.index,
    extension,
    body.filename
  );

  if (!path) {
    return res.status(400).json({ error: "Invalid image destination." });
  }

  try {
    await site.writeImage(path, decoded.content, "content: add image " + path);
    return res.status(200).json({ ok: true, path });
  } catch (error) {
    console.error("Portfolio image upload API:", error);
    return res.status(502).json({ error: "Could not upload the image." });
  }
};
