const crypto = require("crypto");

const OWNER = "raihanavis0-nav";
const REPO = "webgw";
const BRANCH = "main";
const DATA_PATH = "js/data.js";
const API_ROOT = "https://api.github.com/repos/" + OWNER + "/" + REPO;

function githubToken() {
  return process.env.THOUGHTS_GITHUB_TOKEN || "";
}

function headers(write) {
  const result = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (write) {
    const token = githubToken();
    if (!token) {
      const error = new Error("GitHub write access is not configured.");
      error.status = 503;
      throw error;
    }
    result.Authorization = "Bearer " + token;
    result["Content-Type"] = "application/json";
  }

  return result;
}

function encodedPath(path) {
  return String(path || "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
}

function contentUrl(path) {
  return API_ROOT + "/contents/" + encodedPath(path);
}

async function requestJson(url, options, write) {
  const response = await fetch(
    url,
    Object.assign({}, options || {}, {
      headers: Object.assign(
        {},
        headers(Boolean(write)),
        (options && options.headers) || {}
      ),
    })
  );

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(
      "GitHub request failed (" + response.status + ")."
    );
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  return response.json();
}

async function getFile(path) {
  return requestJson(
    contentUrl(path) + "?ref=" + encodeURIComponent(BRANCH),
    null,
    false
  );
}

async function getDataSource() {
  const file = await getFile(DATA_PATH);
  const text = Buffer.from(
    String(file.content || "").replace(/\n/g, ""),
    "base64"
  ).toString("utf8");

  return { sha: file.sha, text };
}

async function writeDataSource(text, sha, message) {
  const encoded = Buffer.from(String(text || ""), "utf8").toString("base64");
  return requestJson(
    contentUrl(DATA_PATH),
    {
      method: "PUT",
      body: JSON.stringify({
        message: String(message || "content: update site data")
          .replace(/[\r\n]+/g, " ")
          .slice(0, 120),
        content: encoded,
        branch: BRANCH,
        sha,
      }),
    },
    true
  );
}

async function writeImage(path, base64Content, message) {
  return requestJson(
    contentUrl(path),
    {
      method: "PUT",
      body: JSON.stringify({
        message: String(message || "content: upload image")
          .replace(/[\r\n]+/g, " ")
          .slice(0, 120),
        content: base64Content,
        branch: BRANCH,
      }),
    },
    true
  );
}

function slugify(value) {
  return (
    String(value || "")
      .toLowerCase()
      .trim()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "image"
  );
}

function safeImagePath(path) {
  const value = String(path || "").replace(/^\/+/, "");
  if (!/^assets\/img\/[a-zA-Z0-9._/-]+\.(?:webp|jpe?g|png)$/i.test(value)) {
    return "";
  }
  if (value.includes("..")) return "";
  return value;
}

function uniqueImagePath(folder, baseName, index, extension, originalName) {
  const safeFolder = String(folder || "").replace(/^\/+|\/+$/g, "");
  if (
    !/^assets\/img(?:\/[a-zA-Z0-9._-]+)*$/.test(safeFolder) ||
    safeFolder.includes("..")
  ) {
    return "";
  }

  const ext = String(extension || "").toLowerCase();
  if (!["webp", "jpg", "jpeg", "png"].includes(ext)) return "";

  let name;
  if (baseName) {
    const base = slugify(baseName);
    const n = Number(index);
    if (!Number.isInteger(n) || n < 1 || n > 9999) return "";
    name = base + "-" + String(n).padStart(2, "0") + "." + ext;
  } else {
    const raw = String(originalName || "image").replace(/\.[^.]+$/, "");
    name =
      slugify(raw) +
      "-" +
      Date.now() +
      "-" +
      crypto.randomBytes(3).toString("hex") +
      "." +
      ext;
  }

  return safeFolder + "/" + name;
}

function findArrayProperty(source, propertyName, fromIndex) {
  const startAt = Math.max(0, Number(fromIndex) || 0);
  const pattern = new RegExp("\\b" + propertyName + "\\s*:\\s*\\[", "g");
  pattern.lastIndex = startAt;
  const match = pattern.exec(source);
  if (!match) return null;

  const open = source.indexOf("[", match.index);
  const close = findMatchingBracket(source, open, "[", "]");
  if (close < 0) return null;

  return { propertyIndex: match.index, open, close };
}

function findMatchingBracket(source, start, openChar, closeChar) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (lineComment) {
      if (ch === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      if (ch === "*" && next === "/") {
        blockComment = false;
        i += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = "";
      continue;
    }

    if (ch === "/" && next === "/") {
      lineComment = true;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      blockComment = true;
      i += 1;
      continue;
    }
    if (ch === "\"" || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }

    if (ch === openChar) depth += 1;
    else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function indentBlock(value, spaces) {
  const prefix = " ".repeat(spaces);
  return String(value)
    .split("\n")
    .map(function (line) {
      return prefix + line;
    })
    .join("\n");
}

function addFilm(source, entry) {
  const films = findArrayProperty(source, "films", 0);
  if (!films) throw new Error("Films collection was not found.");

  const insert = "\n    " + JSON.stringify(entry) + ",";
  return source.slice(0, films.open + 1) + insert + source.slice(films.open + 1);
}

function addNewAlbum(source, album) {
  const projects = findArrayProperty(source, "projects", 0);
  if (!projects) throw new Error("Projects collection was not found.");

  const item = {
    album: album.name,
    role: "Design",
    cover: album.paths[0],
    images: album.paths,
  };
  const insert = "\n" + indentBlock(JSON.stringify(item, null, 2), 4) + ",";
  return (
    source.slice(0, projects.open + 1) +
    insert +
    source.slice(projects.open + 1)
  );
}

function addImagesToAlbum(source, albumName, paths) {
  const projects = findArrayProperty(source, "projects", 0);
  if (!projects) throw new Error("Projects collection was not found.");

  const projectText = source.slice(projects.open + 1, projects.close);
  const quoted = JSON.stringify(String(albumName || ""));
  const candidates = ["album: " + quoted, "title: " + quoted];

  let localIndex = -1;
  for (const candidate of candidates) {
    localIndex = projectText.indexOf(candidate);
    if (localIndex >= 0) break;
  }

  if (localIndex < 0) throw new Error("Album was not found.");

  const absolute = projects.open + 1 + localIndex;
  const images = findArrayProperty(source, "images", absolute);
  if (!images || images.open > projects.close) {
    throw new Error("Album image collection was not found.");
  }

  const insert =
    paths
      .map(function (path) {
        return "\n        " + JSON.stringify(path) + ",";
      })
      .join("") || "";

  return source.slice(0, images.close) + insert + source.slice(images.close);
}

module.exports = {
  addFilm,
  addImagesToAlbum,
  addNewAlbum,
  getDataSource,
  safeImagePath,
  slugify,
  uniqueImagePath,
  writeDataSource,
  writeImage,
};
