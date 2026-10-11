const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

function contentTypeForExtension(extension) {
  if (extension === "mp3") return "audio/mpeg";
  if (extension === "m4a") return "audio/mp4";
  if (extension === "ogg") return "audio/ogg";
  return "application/octet-stream";
}

function isChunkManifest(path) {
  return String(path || "").toLowerCase().endsWith(".chunks.json");
}

function validChunkPath(path) {
  return /^assets\/thoughts\/audio\/chunks\/[a-zA-Z0-9._-]+\.part$/.test(
    String(path || "")
  );
}

async function loadChunkedAudio(store, path) {
  const manifestFile = await store.getRawFile(path);
  let manifest;

  try {
    manifest = JSON.parse(manifestFile.buffer.toString("utf8"));
  } catch (_) {
    const error = new Error("Invalid audio manifest.");
    error.status = 502;
    throw error;
  }

  const extension = String(manifest.extension || "").toLowerCase();
  const totalSize = Number(manifest.totalSize || 0);
  const chunks = Array.isArray(manifest.chunks) ? manifest.chunks : [];

  if (
    manifest.kind !== "chunked-audio" ||
    !["mp3", "m4a", "ogg"].includes(extension) ||
    !Number.isInteger(totalSize) ||
    totalSize <= 0 ||
    totalSize > MAX_AUDIO_BYTES ||
    !chunks.length ||
    chunks.length > 8
  ) {
    const error = new Error("Invalid audio manifest.");
    error.status = 502;
    throw error;
  }

  for (const chunk of chunks) {
    if (
      !chunk ||
      !validChunkPath(chunk.path) ||
      !Number.isInteger(Number(chunk.size)) ||
      Number(chunk.size) <= 0
    ) {
      const error = new Error("Invalid audio chunk metadata.");
      error.status = 502;
      throw error;
    }
  }

  const files = await Promise.all(
    chunks.map((chunk) => store.getRawFile(chunk.path))
  );

  let actualSize = 0;
  const buffers = files.map((file, index) => {
    const expected = Number(chunks[index].size);
    if (file.buffer.length !== expected) {
      const error = new Error("Audio chunk size mismatch.");
      error.status = 502;
      throw error;
    }
    actualSize += file.buffer.length;
    return file.buffer;
  });

  if (actualSize !== totalSize || actualSize > MAX_AUDIO_BYTES) {
    const error = new Error("Audio size mismatch.");
    error.status = 502;
    throw error;
  }

  return {
    buffer: Buffer.concat(buffers, actualSize),
    contentType: contentTypeForExtension(extension),
  };
}

// For audio seeking, fetch only the chunks overlapping the requested range.
async function loadChunkedRange(store, path, range) {
  if (!isChunkManifest(path)) return null;
  const manifestFile = await store.getRawFile(path);
  let m;
  try { m = JSON.parse(manifestFile.buffer.toString("utf8")); }
  catch (_) { const error = new Error("Invalid audio manifest."); error.status = 502; throw error; }
  const extension = String(m.extension || "").toLowerCase();
  const total = Number(m.totalSize || 0);
  const chunks = Array.isArray(m.chunks) ? m.chunks : [];
  if (m.kind !== "chunked-audio" || !["mp3","m4a","ogg"].includes(extension) ||
      !Number.isInteger(total) || total < 1 || total > MAX_AUDIO_BYTES ||
      chunks.length < 1 || chunks.length > 8) {
    const error = new Error("Invalid audio manifest."); error.status = 502; throw error;
  }
  let offset = 0;
  const layout = chunks.map(chunk => {
    const size = Number(chunk && chunk.size);
    if (!chunk || !validChunkPath(chunk.path) || !Number.isInteger(size) || size <= 0) {
      const error = new Error("Invalid audio chunk metadata."); error.status = 502; throw error;
    }
    const start = offset;
    offset += size;
    return { path: chunk.path, start, end: offset - 1, size };
  });
  if (offset !== total) {
    const error = new Error("Audio manifest size mismatch."); error.status = 502; throw error;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(range || ""));
  if (!match) return null;
  let first, last;
  if (match[1]) {
    first = Number(match[1]);
    last = match[2] ? Number(match[2]) : total - 1;
  } else {
    const suffix = Number(match[2]);
    if (!suffix) return null;
    first = Math.max(0, total - suffix);
    last = total - 1;
  }
  if (!Number.isInteger(first) || !Number.isInteger(last) || first < 0 ||
      last < first || first >= total) return null;
  last = Math.min(last, total - 1);
  const selected = layout.filter(chunk => chunk.end >= first && chunk.start <= last);
  const segments = await Promise.all(selected.map(async chunk => {
    const file = await store.getRawFile(chunk.path);
    if (file.buffer.length !== chunk.size) {
      const error = new Error("Audio chunk size mismatch."); error.status = 502; throw error;
    }
    return file.buffer.subarray(
      Math.max(0,first - chunk.start),
      Math.min(chunk.size,last - chunk.start + 1)
    );
  }));
  return { buffer: Buffer.concat(segments, last-first+1), start:first, end:last,
    total, contentType:contentTypeForExtension(extension) };
}

async function load(store, path) {
  if (isChunkManifest(path)) {
    return loadChunkedAudio(store, path);
  }
  return store.getRawFile(path);
}

module.exports = {
  MAX_AUDIO_BYTES,
  load,
  loadChunkedRange,
};
