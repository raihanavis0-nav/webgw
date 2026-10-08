const admin = require("../../server/thoughts-admin");
const store = require("../../server/thoughts-store");

function bodyObject(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch (_) {
    return {};
  }
}

function isString(value) {
  return typeof value === "string";
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function validateBannerPath(path, ownerLabel) {
  if (path == null || path === "") return "";
  if (!isString(path)) return "Invalid " + ownerLabel + " banner.";
  if (
    !/^assets\/thoughts\/[a-zA-Z0-9._/-]+\.(webp|jpg|jpeg|png)$/i.test(path)
  ) {
    return "Invalid " + ownerLabel + " banner path.";
  }
  return "";
}

function validateCoverPath(path, ownerLabel) {
  if (path == null || path === "") return "";
  if (!isString(path)) return "Invalid " + ownerLabel + " book cover.";
  if (
    !/^assets\/thoughts\/[a-zA-Z0-9._/-]+\.(webp|jpg|jpeg|png)$/i.test(path)
  ) {
    return "Invalid " + ownerLabel + " book cover path.";
  }
  return "";
}

function validateImagePath(path, ownerLabel) {
  if (path == null || path === "") return "";
  if (!isString(path)) return "Invalid " + ownerLabel + " image.";
  if (
    !/^assets\/thoughts\/[a-zA-Z0-9._/-]+\.(webp|jpg|jpeg|png)$/i.test(path)
  ) {
    return "Invalid " + ownerLabel + " image path.";
  }
  return "";
}

function validateEndingSong(song, ownerLabel) {
  if (song == null) return "";
  if (!song || typeof song !== "object" || Array.isArray(song)) {
    return "Invalid " + ownerLabel + " ending song.";
  }
  if (song.title != null && !isString(song.title)) {
    return "Invalid ending song title.";
  }
  if (song.artist != null && !isString(song.artist)) {
    return "Invalid ending song artist.";
  }
  if (song.path != null && !isString(song.path)) {
    return "Invalid ending song path.";
  }
  if (
    song.path &&
    !/^assets\/thoughts\/audio\/[a-zA-Z0-9._/-]+\.(mp3|m4a|ogg)(?:\.chunks\.json)?$/i.test(song.path)
  ) {
    return "Invalid ending song media path.";
  }
  return "";
}

function validateData(data) {
  if (!data || typeof data !== "object") return "Invalid stories data.";

  const appearance = data.appearance || {};
  if (typeof appearance !== "object" || Array.isArray(appearance)) return "Invalid appearance settings.";
  if (appearance.title != null && (typeof appearance.title !== "string" || appearance.title.length > 120)) return "Invalid Reader title.";
  if (appearance.subtitle != null && (typeof appearance.subtitle !== "string" || appearance.subtitle.length > 280)) return "Invalid Reader subtitle.";
  for (const key of ["login", "hero"]) {
    const item = appearance[key] || {};
    if (typeof item !== "object" || Array.isArray(item)) return "Invalid appearance image settings.";
    if (item.image && (typeof item.image !== "string" || !/^assets\/thoughts\/[a-zA-Z0-9._/-]+\.(webp|jpg|jpeg|png|gif)$/i.test(item.image) || item.image.includes(".."))) return "Invalid appearance image path.";
    if (item.ratio != null && !["3:1", "5:1", "16:9", "4:3", "1:1", "3:4", "9:16", "1:3", "1:5"].includes(item.ratio)) return "Invalid preview ratio.";
    for (const prop of ["x", "y"]) if (item[prop] != null && (!isNumber(item[prop]) || item[prop] < 0 || item[prop] > 100)) return "Invalid focal point.";
    if (item.zoom != null && (!isNumber(item.zoom) || item.zoom < 100 || item.zoom > 250)) return "Invalid image zoom.";
  }
  const series = Array.isArray(data.series) ? data.series : null;
  const subseries = Array.isArray(data.subseries) ? data.subseries : null;
  const characters = Array.isArray(data.characters) ? data.characters : null;
  const stories = Array.isArray(data.stories) ? data.stories : null;
  const worldEntries = Array.isArray(data.worldEntries) ? data.worldEntries : null;
  const galleryItems = Array.isArray(data.galleryItems) ? data.galleryItems : null;

  if (!series || !subseries || !characters || !stories || !worldEntries || !galleryItems) {
    return "Stories data is missing one or more collections.";
  }

  for (const item of series) {
    if (!item || !isString(item.id) || !isString(item.name)) {
      return "Invalid series entry.";
    }
    if (item.slug != null && !isString(item.slug)) return "Invalid series slug.";
    if (item.description != null && !isString(item.description)) {
      return "Invalid series description.";
    }
    if (item.order != null && !isNumber(item.order)) {
      return "Invalid series order.";
    }
    const bannerError = validateBannerPath(item.banner, "Series");
    if (bannerError) return bannerError;
    const coverError = validateCoverPath(item.cover, "Series");
    if (coverError) return coverError;
    if (item.posterRatio != null) {
      if (!isString(item.posterRatio) || !/^(?:[1-9]|10)(?:\.\d{1,2})?:(?:[1-9]|10)(?:\.\d{1,2})?$/.test(item.posterRatio)) {
        return "Invalid poster ratio.";
      }
      const parts = item.posterRatio.split(":").map(Number);
      if (parts[0] / parts[1] < 0.2 || parts[0] / parts[1] > 5) return "Poster ratio must be between 1:5 and 5:1.";
    }
    if (item.posters != null) {
      if (!Array.isArray(item.posters) || item.posters.length > 20) return "Too many Series posters (maximum 20).";
      const seen = new Set();
      for (const poster of item.posters) {
        if (!poster || typeof poster !== "object" || Array.isArray(poster)) return "Invalid Series poster.";
        if (!isString(poster.path) || !/^assets\/thoughts\/[a-zA-Z0-9._/-]+\.(?:webp|jpg|jpeg|png)$/i.test(poster.path) || poster.path.includes("..")) {
          return "Invalid Series poster path.";
        }
        if (seen.has(poster.path)) return "Duplicate Series poster.";
        seen.add(poster.path);
        for (const key of ["x", "y", "zoom"]) {
          if (poster[key] != null && (!isNumber(poster[key]) || poster[key] < (key === "zoom" ? 100 : 0) || poster[key] > (key === "zoom" ? 250 : 100))) {
            return "Invalid Series poster position or zoom.";
          }
        }
      }
    }
  }

  for (const item of subseries) {
    if (
      !item ||
      !isString(item.id) ||
      !isString(item.seriesId) ||
      !isString(item.name)
    ) {
      return "Invalid sub-series entry.";
    }
    if (item.slug != null && !isString(item.slug)) {
      return "Invalid sub-series slug.";
    }
    if (item.description != null && !isString(item.description)) {
      return "Invalid sub-series description.";
    }
    if (item.order != null && !isNumber(item.order)) {
      return "Invalid sub-series order.";
    }
    const bannerError = validateBannerPath(item.banner, "Sub-series");
    if (bannerError) return bannerError;
    const coverError = validateCoverPath(item.cover, "Sub-series");
    if (coverError) return coverError;
    if (item.posterRatio != null) {
      if (!isString(item.posterRatio) || !/^(?:[1-9]|10)(?:\.\d{1,2})?:(?:[1-9]|10)(?:\.\d{1,2})?$/.test(item.posterRatio)) {
        return "Invalid poster ratio.";
      }
      const parts = item.posterRatio.split(":").map(Number);
      if (parts[0] / parts[1] < 0.2 || parts[0] / parts[1] > 5) return "Poster ratio must be between 1:5 and 5:1.";
    }
    if (item.posters != null) {
      if (!Array.isArray(item.posters) || item.posters.length > 20) return "Too many Sub-series posters (maximum 20).";
      const seen = new Set();
      for (const poster of item.posters) {
        if (!poster || typeof poster !== "object" || Array.isArray(poster)) return "Invalid Sub-series poster.";
        if (!isString(poster.path) || !/^assets\/thoughts\/[a-zA-Z0-9._/-]+\.(?:webp|jpg|jpeg|png)$/i.test(poster.path) || poster.path.includes("..")) {
          return "Invalid Sub-series poster path.";
        }
        if (seen.has(poster.path)) return "Duplicate Sub-series poster.";
        seen.add(poster.path);
        for (const key of ["x", "y", "zoom"]) {
          if (poster[key] != null && (!isNumber(poster[key]) || poster[key] < (key === "zoom" ? 100 : 0) || poster[key] > (key === "zoom" ? 250 : 100))) {
            return "Invalid Sub-series poster position or zoom.";
          }
        }
      }
    }

    if (item.uiTheme != null) {
      if (!item.uiTheme || typeof item.uiTheme !== "object" || Array.isArray(item.uiTheme)) return "Invalid Sub-series UI theme.";
      if (item.uiTheme.background != null && (!isString(item.uiTheme.background) || !/^#[a-fA-F0-9]{6}$/.test(item.uiTheme.background))) return "Invalid Sub-series UI background.";
      if (item.uiTheme.font != null && (!isString(item.uiTheme.font) || item.uiTheme.font.length > 70 || (item.uiTheme.font && !/^[a-zA-Z0-9][a-zA-Z0-9 +&.'-]*$/.test(item.uiTheme.font)))) return "Invalid Sub-series UI font.";
    }
    if (item.paperTheme != null) {
      if (!item.paperTheme || typeof item.paperTheme !== "object" || Array.isArray(item.paperTheme) || !isString(item.paperTheme.background) || !/^#[a-fA-F0-9]{6}$/.test(item.paperTheme.background)) return "Invalid Sub-series paper color.";
    }
    const endingSongError = validateEndingSong(item.endingSong, "Sub-series");
    if (endingSongError) return endingSongError;
  }

  for (const item of characters) {
    if (!item || !isString(item.id) || !isString(item.name)) {
      return "Invalid character entry.";
    }
    if (item.seriesId != null && !isString(item.seriesId)) {
      return "Invalid character series.";
    }
    if (item.subseriesId != null && !isString(item.subseriesId)) {
      return "Invalid character sub-series.";
    }
    if (item.portrait != null && !isString(item.portrait)) {
      return "Invalid character portrait.";
    }
    if (item.order != null && !isNumber(item.order)) {
      return "Invalid character order.";
    }
    if (item.bio != null && !isString(item.bio)) {
      return "Invalid character bio.";
    }
  }

  for (const story of stories) {
    if (
      !story ||
      !isString(story.id) ||
      !isString(story.title) ||
      !isString(story.date) ||
      !isString(story.slug) ||
      !isString(story.body)
    ) {
      return "Invalid story entry.";
    }

    if (story.seriesId != null && !isString(story.seriesId)) {
      return "Invalid story series.";
    }
    if (story.subseriesId != null && !isString(story.subseriesId)) {
      return "Invalid story sub-series.";
    }
    if (story.order != null && !isNumber(story.order)) {
      return "Invalid story order.";
    }
    if (
      Object.prototype.hasOwnProperty.call(story, "published") &&
      typeof story.published !== "boolean"
    ) {
      return "Invalid published value.";
    }
    if (
      story.characterIds != null &&
      (!Array.isArray(story.characterIds) ||
        story.characterIds.some(function (id) {
          return !isString(id);
        }))
    ) {
      return "Invalid story characters.";
    }

    if (story.timelineLabel != null && !isString(story.timelineLabel)) {
      return "Invalid Story timeline label.";
    }
    if (story.timelineGroup != null && !isString(story.timelineGroup)) {
      return "Invalid Story timeline group.";
    }
    if (story.timelineOrder != null && !isNumber(story.timelineOrder)) {
      return "Invalid Story timeline order.";
    }
    if (
      Object.prototype.hasOwnProperty.call(story, "timelineEnabled") &&
      typeof story.timelineEnabled !== "boolean"
    ) {
      return "Invalid Story timeline visibility.";
    }

    const bannerError = validateBannerPath(story.banner, "Story");
    if (bannerError) return bannerError;

    const endingSongError = validateEndingSong(story.endingSong, "Story");
    if (endingSongError) return endingSongError;
  }

  const seriesIds = new Set(
    series.map(function (item) {
      return item.id;
    })
  );
  const subseriesById = new Map(
    subseries.map(function (item) {
      return [item.id, item];
    })
  );
  const characterIds = new Set(
    characters.map(function (item) {
      return item.id;
    })
  );

  if (seriesIds.size !== series.length) return "Duplicate Series id.";
  if (subseriesById.size !== subseries.length) return "Duplicate Sub-series id.";
  if (characterIds.size !== characters.length) return "Duplicate Character id.";

  for (const item of subseries) {
    if (!seriesIds.has(item.seriesId)) {
      return "A Sub-series points to a Series that does not exist.";
    }
  }

  for (const item of characters) {
    if (item.seriesId && !seriesIds.has(item.seriesId)) {
      return "A Character points to a Series that does not exist.";
    }

    if (item.subseriesId) {
      const parent = subseriesById.get(item.subseriesId);
      if (!parent) {
        return "A Character points to a Sub-series that does not exist.";
      }
      if (!item.seriesId || parent.seriesId !== item.seriesId) {
        return "A Character Sub-series does not belong to its Series.";
      }
    }
  }

  const storyIds = new Set();
  const storySlugs = new Set();

  for (const story of stories) {
    if (storyIds.has(story.id)) return "Duplicate Story id.";
    storyIds.add(story.id);

    if (storySlugs.has(story.slug)) return "Duplicate Story slug.";
    storySlugs.add(story.slug);

    if (!story.seriesId || !seriesIds.has(story.seriesId)) {
      return "Every Story must point to an existing Series.";
    }

    if (story.subseriesId) {
      const parent = subseriesById.get(story.subseriesId);
      if (!parent) {
        return "A Story points to a Sub-series that does not exist.";
      }
      if (parent.seriesId !== story.seriesId) {
        return "A Story Sub-series does not belong to its Series.";
      }
    }

    if (
      Array.isArray(story.characterIds) &&
      story.characterIds.some(function (id) {
        return !characterIds.has(id);
      })
    ) {
      return "A Story points to a Character that does not exist.";
    }
  }

  const worldIds = new Set();
  const allowedWorldCategories = new Set([
    "locations",
    "organizations",
    "events",
    "objects",
    "terms",
  ]);

  for (const item of worldEntries) {
    if (
      !item ||
      !isString(item.id) ||
      !isString(item.name) ||
      !isString(item.category)
    ) {
      return "Invalid World entry.";
    }
    if (item.seriesId != null && (!isString(item.seriesId) || (item.seriesId && !seriesIds.has(item.seriesId)))) return "A World entry must reference an existing Series.";
    if (worldIds.has(item.id)) return "Duplicate World entry id.";
    worldIds.add(item.id);

    if (!allowedWorldCategories.has(item.category)) {
      return "Invalid World category.";
    }
    if (item.description != null && !isString(item.description)) {
      return "Invalid World description.";
    }
    if (item.order != null && !isNumber(item.order)) {
      return "Invalid World order.";
    }
    const imageError = validateImagePath(item.image, "World");
    if (imageError) return imageError;

    if (
      item.relatedCharacterIds != null &&
      (!Array.isArray(item.relatedCharacterIds) ||
        item.relatedCharacterIds.some(function (id) {
          return !isString(id) || !characterIds.has(id);
        }))
    ) {
      return "A World entry points to a Character that does not exist.";
    }

    if (
      item.relatedStoryIds != null &&
      (!Array.isArray(item.relatedStoryIds) ||
        item.relatedStoryIds.some(function (id) {
          return !isString(id) || !storyIds.has(id);
        }))
    ) {
      return "A World entry points to a Story that does not exist.";
    }
  }

  const galleryIds = new Set();
  const allowedGalleryCategories = new Set([
    "character",
    "banner",
    "poster",
    "artwork",
  ]);

  for (const item of galleryItems) {
    if (
      !item ||
      !isString(item.id) ||
      !isString(item.category) ||
      !isString(item.image)
    ) {
      return "Invalid Gallery item.";
    }
    if (galleryIds.has(item.id)) return "Duplicate Gallery item id.";
    galleryIds.add(item.id);

    if (!allowedGalleryCategories.has(item.category)) {
      return "Invalid Gallery category.";
    }
    if (item.title != null && !isString(item.title)) {
      return "Invalid Gallery title.";
    }
    if (item.caption != null && !isString(item.caption)) {
      return "Invalid Gallery caption.";
    }
    if (item.order != null && !isNumber(item.order)) {
      return "Invalid Gallery order.";
    }
    const imageError = validateImagePath(item.image, "Gallery");
    if (imageError) return imageError;

    if (item.category === "character") {
      if (!item.characterId || !characterIds.has(item.characterId)) {
        return "A Character Gallery item must point to an existing Character.";
      }
    } else if (item.characterId) {
      return "Only Character Gallery items can point to a Character.";
    }
  }

  const serialized = JSON.stringify(data);
  if (Buffer.byteLength(serialized, "utf8") > 1500000) {
    return "Stories data is too large.";
  }

  return "";
}

function normalizedData(data) {
  return {
    schemaVersion: 3,
    appearance: data.appearance && typeof data.appearance === "object" ? data.appearance : {},
    series: Array.isArray(data.series) ? data.series : [],
    subseries: Array.isArray(data.subseries) ? data.subseries : [],
    characters: Array.isArray(data.characters) ? data.characters : [],
    stories: Array.isArray(data.stories) ? data.stories : [],
    worldEntries: Array.isArray(data.worldEntries) ? data.worldEntries : [],
    galleryItems: Array.isArray(data.galleryItems) ? data.galleryItems : [],
  };
}

function preserveSongField(incomingItems, currentItems) {
  const songsById = new Map(
    currentItems.map(function (item) {
      return [item.id, item.endingSong];
    })
  );

  incomingItems.forEach(function (item) {
    if (
      !Object.prototype.hasOwnProperty.call(item, "endingSong") &&
      songsById.has(item.id) &&
      songsById.get(item.id) != null
    ) {
      item.endingSong = songsById.get(item.id);
    }
  });
}

function preserveBannerField(incomingItems, currentItems) {
  const bannersById = new Map(
    currentItems.map(function (item) {
      return [item.id, item.banner];
    })
  );

  incomingItems.forEach(function (item) {
    if (
      !Object.prototype.hasOwnProperty.call(item, "banner") &&
      bannersById.has(item.id) &&
      bannersById.get(item.id) != null
    ) {
      item.banner = bannersById.get(item.id);
    }
  });
}

function preserveCoverField(incomingItems, currentItems) {
  const coversById = new Map(
    currentItems.map(function (item) {
      return [item.id, item.cover];
    })
  );

  incomingItems.forEach(function (item) {
    if (
      !Object.prototype.hasOwnProperty.call(item, "cover") &&
      coversById.has(item.id) &&
      coversById.get(item.id) != null
    ) {
      item.cover = coversById.get(item.id);
    }
  });
}

async function preserveEndingSongs(data, message) {
  const latest = await store.readLibrary();
  const current = normalizedData(latest.data || {});
  const updatingEndingSong = String(message || "").startsWith(
    "stories: update ending song"
  );

  if (!updatingEndingSong) {
    preserveSongField(data.subseries, current.subseries);
    preserveSongField(data.stories, current.stories);
  }

  preserveBannerField(data.series, current.series);
  preserveBannerField(data.subseries, current.subseries);
  preserveBannerField(data.stories, current.stories);
  preserveCoverField(data.series, current.series);
  preserveCoverField(data.subseries, current.subseries);

  return data;
}

module.exports = async function handler(req, res) {
  admin.noStore(res);

  const session = admin.requireSession(req, res);
  if (!session) return;

  try {
    if (req.method === "GET") {
      const library = await store.readLibrary();
      return res.status(200).json({
        data: normalizedData(library.data || {}),
        revision: library.sha,
      });
    }

    if (req.method === "PUT") {
      if (!admin.requireSameOrigin(req, res)) return;

      const body = bodyObject(req);
      const message = String(body.message || "stories: update library");
      const data = await preserveEndingSongs(
        normalizedData(body.data || {}),
        message
      );
      const error = validateData(data);

      if (error) {
        return res.status(400).json({ error: error });
      }

      const result = await store.writeLibrary(
        data,
        message,
        String(body.revision || "")
      );

      return res.status(200).json({
        ok: true,
        revision:
          result && result.content && result.content.sha
            ? result.content.sha
            : null,
      });
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    console.error("Stories admin content API:", error);

    if (error && error.status === 409) {
      return res.status(409).json({
        error: "This library changed in another tab or session. Reload before saving again.",
      });
    }

    if (error && error.status === 503) {
      return res.status(503).json({
        error: "Archive storage is not configured. Set THOUGHTS_GITHUB_TOKEN in the Vercel project environment.",
        code: "STORAGE_NOT_CONFIGURED",
      });
    }
    if (error && (error.status === 401 || error.status === 403)) {
      return res.status(502).json({
        error: "GitHub denied archive storage access. Check THOUGHTS_GITHUB_TOKEN and Contents read/write permission on the repository.",
        code: "STORAGE_ACCESS_DENIED",
      });
    }
    if (error && error.status === 404) {
      return res.status(502).json({
        error: "Archive storage repository, data file, or thoughts-data branch was not found or cannot be accessed by the token.",
        code: "STORAGE_NOT_FOUND",
      });
    }
    return res.status(502).json({
      error: "Could not update the stories library. Check the Vercel runtime logs for the GitHub storage error.",
      code: "STORAGE_WRITE_FAILED",
    });
  }
};
