/* =============================================================
   admin.js — lightweight Git-based CMS for the portfolio.
   Commits films & work images straight to GitHub via the REST API,
   which triggers a Vercel redeploy (live in ~1 minute).
   The GitHub token is stored only in this browser's localStorage.
   ============================================================= */
(function () {
  "use strict";

  var GH = {
    owner: "alfathxxxxyz",
    repo: "websiteguaa",
    branch: "main",
    api: "https://api.github.com",
  };

  var $ = function (id) {
    return document.getElementById(id);
  };
  var token = "";

  /* ---------------- helpers ---------------- */
  function headers() {
    return {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };
  }

  function utf8ToB64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64ToUtf8(b64) {
    return decodeURIComponent(escape(atob(b64.replace(/\n/g, ""))));
  }
  function slugify(s) {
    return (
      String(s || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "album"
    );
  }

  function logLine(el, msg, cls) {
    el.classList.add("show");
    var span = document.createElement("div");
    if (cls) span.className = cls;
    span.textContent = msg;
    el.appendChild(span);
    el.scrollTop = el.scrollHeight;
  }
  function clearLog(el) {
    el.innerHTML = "";
  }

  /* ---------------- GitHub API ---------------- */
  function contentsUrl(path) {
    return GH.api + "/repos/" + GH.owner + "/" + GH.repo + "/contents/" + path;
  }

  function getFile(path) {
    return fetch(contentsUrl(path) + "?ref=" + GH.branch, {
      headers: headers(),
    }).then(function (r) {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("GET " + path + " → " + r.status);
      return r.json().then(function (j) {
        return { sha: j.sha, text: b64ToUtf8(j.content) };
      });
    });
  }

  function putFile(path, contentB64, message, sha) {
    var body = { message: message, content: contentB64, branch: GH.branch };
    if (sha) body.sha = sha;
    return fetch(contentsUrl(path), {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(body),
    }).then(function (r) {
      if (!r.ok)
        return r.text().then(function (t) {
          throw new Error("PUT " + path + " → " + r.status + " " + t);
        });
      return r.json();
    });
  }

  /* ---------------- data.js (re)generation ---------------- */
  function parseDataJs(text) {
    /* the file defines `const siteData = {...};` */
    var fn = new Function(text + "\n; return siteData;");
    return fn();
  }
  function serializeDataJs(obj) {
    return (
      "/* =============================================================\n" +
      "   WEBSITE CONTENT DATA\n" +
      "   Managed by the admin panel (admin.html). You can still edit by\n" +
      "   hand, just keep the `const siteData = { ... };` shape.\n" +
      "   ============================================================= */\n" +
      "const siteData = " +
      JSON.stringify(obj, null, 2) +
      ";\n"
    );
  }
  // Always fetch the latest data.js, apply mutator(siteData), commit it.
  function updateDataJs(mutator, message, log) {
    return getFile("js/data.js").then(function (file) {
      if (!file) throw new Error("js/data.js tidak ditemukan di repo.");
      var data = parseDataJs(file.text);
      mutator(data);
      var content = utf8ToB64(serializeDataJs(data));
      logLine(log, "→ commit js/data.js …");
      return putFile("js/data.js", content, message, file.sha);
    });
  }

  /* ---------------- image compression ---------------- */
  function loadImage(file) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () {
        res(img);
      };
      img.onerror = function () {
        rej(new Error("Gagal baca gambar: " + file.name));
      };
      img.src = URL.createObjectURL(file);
    });
  }
  function compressImage(file, maxW, quality) {
    maxW = maxW || 1500;
    quality = quality || 0.82;
    return loadImage(file).then(function (img) {
      var w = img.naturalWidth || img.width;
      var h = img.naturalHeight || img.height;
      if (w > maxW) {
        h = Math.round((h * maxW) / w);
        w = maxW;
      }
      var canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      return new Promise(function (res) {
        canvas.toBlob(
          function (blob) {
            if (blob && blob.type === "image/webp") {
              res({ blob: blob, ext: "webp" });
            } else {
              canvas.toBlob(
                function (jpg) {
                  res({ blob: jpg, ext: "jpg" });
                },
                "image/jpeg",
                0.85
              );
            }
          },
          "image/webp",
          quality
        );
      });
    });
  }
  function blobToB64(blob) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () {
        res(String(fr.result).split(",")[1]);
      };
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  }

  /* ---------------- actions ---------------- */
  function addFilm(title, rating, log) {
    var entry =
      rating === "N/R" ? title + " (N/R)" : title + " (" + rating + "/5)";
    return updateDataJs(
      function (data) {
        if (!Array.isArray(data.films)) data.films = [];
        data.films.unshift(entry);
      },
      'content: add film "' + title + '"',
      log
    );
  }

  // Upload compressed files to a folder; returns array of repo paths.
  function uploadImages(files, folder, baseName, startIndex, log) {
    var paths = [];
    var chain = Promise.resolve();
    files.forEach(function (file, i) {
      chain = chain.then(function () {
        logLine(log, "→ proses " + file.name + " …");
        return compressImage(file).then(function (out) {
          var name = baseName
            ? baseName + "-" + pad(startIndex + i) + "." + out.ext
            : safeName(file.name, out.ext);
          var path = folder ? folder + "/" + name : name;
          return blobToB64(out.blob).then(function (b64) {
            logLine(
              log,
              "  upload " + path + " (" + Math.round(out.blob.size / 1024) + " KB)"
            );
            return putFile(
              path,
              b64,
              "content: add image " + path,
              null
            ).then(function () {
              paths.push(path);
            });
          });
        });
      });
    });
    return chain.then(function () {
      return paths;
    });
  }
  function pad(n) {
    return n < 10 ? "0" + n : "" + n;
  }
  function safeName(original, ext) {
    var base = slugify(original.replace(/\.[^.]+$/, ""));
    return base + "-" + Date.now() + "." + ext;
  }
  function folderOf(imagePath) {
    return imagePath.slice(0, imagePath.lastIndexOf("/"));
  }
  function nextIndex(images) {
    var max = 0;
    (images || []).forEach(function (p) {
      var m = p.match(/-(\d+)\.[a-z0-9]+$/i);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return max + 1;
  }

  /* ---------------- UI wiring ---------------- */
  function ready() {
    token = localStorage.getItem("gh_token") || "";
    if (token) connect(true);

    $("connectBtn").addEventListener("click", function () {
      var t = $("tokenInput").value.trim();
      GH.branch = $("branchInput").value.trim() || "main";
      if (!t) {
        logLine($("lockLog"), "Token masih kosong.", "err");
        return;
      }
      token = t;
      connect(false);
    });

    $("lockBtn").addEventListener("click", function () {
      localStorage.removeItem("gh_token");
      token = "";
      location.reload();
    });

    // mode switcher
    Array.prototype.forEach.call(
      document.querySelectorAll(".mode-btn[data-mode]"),
      function (btn) {
        btn.addEventListener("click", function () {
          document
            .querySelectorAll(".mode-btn[data-mode]")
            .forEach(function (b) {
              b.classList.remove("active");
            });
          btn.classList.add("active");
          var mode = btn.getAttribute("data-mode");
          $("modeExisting").classList.toggle("hide", mode !== "existing");
          $("modeNew").classList.toggle("hide", mode !== "new");
        });
      }
    );

    $("addFilmBtn").addEventListener("click", onAddFilm);
    $("addImgBtn").addEventListener("click", onAddImages);
  }

  function connect(silent) {
    var log = $("lockLog");
    clearLog(log);
    logLine(log, "Menghubungkan ke " + GH.owner + "/" + GH.repo + " …");
    fetch(GH.api + "/repos/" + GH.owner + "/" + GH.repo, { headers: headers() })
      .then(function (r) {
        if (!r.ok) throw new Error("Token ditolak (" + r.status + ").");
        return r.json();
      })
      .then(function () {
        localStorage.setItem("gh_token", token);
        $("lockCard").classList.add("hide");
        $("app").classList.remove("hide");
        $("repoLabel").textContent = GH.owner + "/" + GH.repo;
        $("branchLabel").textContent = GH.branch;
        populateAlbums();
      })
      .catch(function (e) {
        token = "";
        if (!silent) logLine(log, "✗ " + e.message, "err");
        else {
          // stored token invalid → show lock form again
          $("lockCard").classList.remove("hide");
          $("app").classList.add("hide");
        }
      });
  }

  function albumsFromData() {
    var out = [];
    if (typeof siteData !== "undefined" && Array.isArray(siteData.projects)) {
      siteData.projects.forEach(function (p, i) {
        if (p && Array.isArray(p.images) && p.images.length) {
          out.push({
            index: i,
            name: p.album || p.title || "Album " + (i + 1),
            folder: folderOf(p.images[0]),
            count: p.images.length,
          });
        }
      });
    }
    return out;
  }
  function populateAlbums() {
    var sel = $("albumSelect");
    sel.innerHTML = "";
    var albums = albumsFromData();
    if (!albums.length) {
      var o = document.createElement("option");
      o.textContent = "(belum ada album — pakai 'Album baru')";
      o.value = "";
      sel.appendChild(o);
      return;
    }
    albums.forEach(function (a) {
      var o = document.createElement("option");
      o.value = a.name;
      o.textContent = a.name + " (" + a.count + " gambar)";
      sel.appendChild(o);
    });
  }

  function busy(btn, on, labelBusy) {
    btn.disabled = on;
    if (on) {
      btn._label = btn.textContent;
      btn.textContent = labelBusy || "Memproses…";
    } else if (btn._label) {
      btn.textContent = btn._label;
    }
  }

  function onAddFilm() {
    var log = $("log");
    clearLog(log);
    var title = $("filmTitle").value.trim();
    var rating = $("filmRating").value;
    if (!title) {
      logLine(log, "Judul film masih kosong.", "err");
      return;
    }
    var btn = $("addFilmBtn");
    busy(btn, true);
    logLine(log, 'Menambah film "' + title + '" …');
    addFilm(title, rating, log)
      .then(function () {
        logLine(log, "✓ Selesai! Live di web ~1 menit lagi.", "ok");
        $("filmTitle").value = "";
      })
      .catch(function (e) {
        logLine(log, "✗ " + e.message, "err");
      })
      .then(function () {
        busy(btn, false);
      });
  }

  function onAddImages() {
    var log = $("log");
    clearLog(log);
    var files = Array.prototype.slice.call($("imgFiles").files);
    if (!files.length) {
      logLine(log, "Belum ada gambar dipilih.", "err");
      return;
    }
    var mode = document
      .querySelector(".mode-btn[data-mode].active")
      .getAttribute("data-mode");
    var btn = $("addImgBtn");
    busy(btn, true);

    var job;
    if (mode === "loose") {
      logLine(log, "Upload " + files.length + " foto lepas …");
      job = uploadImages(files, "assets/img", null, 0, log).then(function () {
        logLine(log, "→ manifest akan diperbarui otomatis oleh GitHub Action.");
      });
    } else if (mode === "new") {
      var name = $("newAlbumName").value.trim();
      if (!name) {
        busy(btn, false);
        logLine(log, "Nama album baru masih kosong.", "err");
        return;
      }
      var slug = slugify(name);
      var folder = "assets/img/" + slug;
      logLine(log, 'Album baru "' + name + '" → ' + folder);
      job = uploadImages(files, folder, slug, 1, log).then(function (paths) {
        return updateDataJs(
          function (data) {
            if (!Array.isArray(data.projects)) data.projects = [];
            data.projects.unshift({
              album: name,
              role: "Designer",
              cover: paths[0],
              images: paths,
            });
          },
          'content: add album "' + name + '"',
          log
        );
      });
    } else {
      // existing
      var chosen = $("albumSelect").value;
      var albums = albumsFromData();
      var album = albums.filter(function (a) {
        return a.name === chosen;
      })[0];
      if (!album) {
        busy(btn, false);
        logLine(log, "Album tidak valid. Pilih lagi.", "err");
        return;
      }
      var slug2 = album.folder.split("/").pop();
      var start = nextIndex(siteData.projects[album.index].images);
      logLine(log, 'Tambah ke album "' + album.name + '" → ' + album.folder);
      job = uploadImages(files, album.folder, slug2, start, log).then(function (
        paths
      ) {
        return updateDataJs(
          function (data) {
            // re-find album by name in the freshly fetched data
            var target = null;
            data.projects.forEach(function (p) {
              if (
                p &&
                (p.album === album.name || p.title === album.name) &&
                Array.isArray(p.images)
              )
                target = p;
            });
            if (!target)
              throw new Error("Album tidak ditemukan di data terbaru.");
            paths.forEach(function (p) {
              target.images.push(p);
            });
          },
          'content: add ' + paths.length + ' image(s) to "' + album.name + '"',
          log
        );
      });
    }

    job
      .then(function () {
        logLine(log, "✓ Selesai! Live di web ~1 menit lagi.", "ok");
        $("imgFiles").value = "";
        $("newAlbumName").value = "";
      })
      .catch(function (e) {
        logLine(log, "✗ " + e.message, "err");
      })
      .then(function () {
        busy(btn, false);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready);
  } else {
    ready();
  }
})();
