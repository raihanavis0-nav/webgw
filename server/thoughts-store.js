const OWNER = "raihanavis0-nav";
const REPO = "webgw";
const DATA_BRANCH = "thoughts-data";
const DATA_PATH = "content/thoughts.json";

const API_ROOT = "https://api.github.com/repos/" + OWNER + "/" + REPO;
const RAW_ROOT =
  "https://raw.githubusercontent.com/" +
  OWNER +
  "/" +
  REPO +
  "/" +
  DATA_BRANCH +
  "/";

// Temporary compatibility path for the large audio chunks that could not be
// copied through the repository connector. New uploads are always written to
// webgw/thoughts-data.
const LEGACY_OWNER = "alfathxxxxyz";
const LEGACY_REPO = "websiteguaa";
const LEGACY_API_ROOT =
  "https://api.github.com/repos/" + LEGACY_OWNER + "/" + LEGACY_REPO;

function githubToken() {
  return process.env.THOUGHTS_GITHUB_TOKEN || "";
}

function legacyGithubToken() {
  return (
    process.env.THOUGHTS_LEGACY_GITHUB_TOKEN ||
    process.env.THOUGHTS_GITHUB_TOKEN ||
    ""
  );
}

function isConfigured() {
  return Boolean(githubToken());
}

function publicHeaders(accept) {
  return {
    Accept: accept || "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function writeHeaders() {
  const token = githubToken();
  if (!token) {
    const error = new Error("GitHub write access is not configured.");
    error.status = 503;
    throw error;
  }

  return {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

function encodedPath(path) {
  return String(path || "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
}

function contentUrl(path, apiRoot) {
  return (apiRoot || API_ROOT) + "/contents/" + encodedPath(path);
}

function rawUrl(path) {
  return RAW_ROOT + encodedPath(path);
}

async function publicJson(url) {
  const response = await fetch(url, { headers: publicHeaders() });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error("GitHub request failed (" + response.status + ").");
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  return response.json();
}

async function writeJson(url, options) {
  const response = await fetch(
    url,
    Object.assign({}, options || {}, {
      headers: Object.assign(
        {},
        writeHeaders(),
        (options && options.headers) || {}
      ),
    })
  );

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error("GitHub write failed (" + response.status + ").");
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  return response.json();
}

async function getFile(path) {
  return publicJson(
    contentUrl(path) + "?ref=" + encodeURIComponent(DATA_BRANCH)
  );
}

async function fetchRaw(url, headers) {
  const response = await fetch(url, { headers });

  if (!response.ok) {
    return { response };
  }

  return {
    response,
    file: {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType:
        response.headers.get("content-type") || "application/octet-stream",
    },
  };
}

async function getRawFile(path) {
  const primary = await fetchRaw(rawUrl(path), {});

  if (primary.file) return primary.file;

  const canUseLegacyAudio =
    primary.response.status === 404 &&
    /^assets\/thoughts\/audio\/chunks\/[a-zA-Z0-9._-]+\.part$/.test(
      String(path || "")
    ) &&
    legacyGithubToken();

  if (canUseLegacyAudio) {
    const legacy = await fetchRaw(
      contentUrl(path, LEGACY_API_ROOT) +
        "?ref=" +
        encodeURIComponent(DATA_BRANCH),
      {
        Authorization: "Bearer " + legacyGithubToken(),
        Accept: "application/vnd.github.raw+json",
        "X-GitHub-Api-Version": "2022-11-28",
      }
    );

    if (legacy.file) return legacy.file;

    const detail = await legacy.response.text();
    const error = new Error(
      "Legacy GitHub media request failed (" + legacy.response.status + ")."
    );
    error.status = legacy.response.status;
    error.detail = detail;
    throw error;
  }

  const detail = await primary.response.text();
  const error = new Error(
    "GitHub media request failed (" + primary.response.status + ")."
  );
  error.status = primary.response.status;
  error.detail = detail;
  throw error;
}

async function readPublicLibrary() {
  const response = await fetch(rawUrl(DATA_PATH), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const error = new Error(
      "Public story storage request failed (" + response.status + ")."
    );
    error.status = response.status;
    throw error;
  }

  return {
    sha: null,
    data: JSON.parse(await response.text()),
  };
}

async function readLibrary() {
  const file = await getFile(DATA_PATH);
  const text = Buffer.from(
    String(file.content || "").replace(/\n/g, ""),
    "base64"
  ).toString("utf8");

  return {
    sha: file.sha,
    data: JSON.parse(text),
  };
}

async function writeLibrary(data, message, expectedSha) {
  const latest = await getFile(DATA_PATH);

  if (expectedSha && latest.sha !== expectedSha) {
    const error = new Error("Stories library changed in another session.");
    error.status = 409;
    error.currentSha = latest.sha;
    throw error;
  }

  const encoded = Buffer.from(
    JSON.stringify(data, null, 2) + "\n",
    "utf8"
  ).toString("base64");

  return writeJson(contentUrl(DATA_PATH), {
    method: "PUT",
    body: JSON.stringify({
      message: String(message || "stories: update library")
        .replace(/[\r\n]+/g, " ")
        .slice(0, 120),
      content: encoded,
      branch: DATA_BRANCH,
      sha: latest.sha,
    }),
  });
}

async function writeMedia(path, base64Content, message) {
  return writeJson(contentUrl(path), {
    method: "PUT",
    body: JSON.stringify({
      message: String(message || "stories: upload media")
        .replace(/[\r\n]+/g, " ")
        .slice(0, 120),
      content: base64Content,
      branch: DATA_BRANCH,
    }),
  });
}

module.exports = {
  DATA_BRANCH,
  DATA_PATH,
  getFile,
  getRawFile,
  isConfigured,
  readLibrary,
  readPublicLibrary,
  writeLibrary,
  writeMedia,
};
