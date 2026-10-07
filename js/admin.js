(function () {
  "use strict";

  var API = {
    session: "/api/thoughts-admin/session",
    login: "/api/thoughts-admin/login",
    logout: "/api/thoughts-admin/logout",
    content: "/api/site-admin/content",
    upload: "/api/site-admin/upload",
  };

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(id, message, kind) {
    var node = $(id);
    node.textContent = message || "";
    node.classList.remove("ok", "err");
    if (kind) node.classList.add(kind);
  }

  function apiJson(url, options) {
    options = options || {};
    options.credentials = "same-origin";
    options.headers = Object.assign(
      { Accept: "application/json" },
      options.headers || {}
    );

    if (options.body && !options.headers["Content-Type"]) {
      options.headers["Content-Type"] = "application/json";
    }

    return fetch(url, options).then(function (response) {
      return response
        .json()
        .catch(function () {
          return {};
        })
        .then(function (body) {
          if (!response.ok) {
            var error = new Error(body.error || "Request failed.");
            error.status = response.status;
            throw error;
          }
          return body;
        });
    });
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
        .slice(0, 60) || "album"
    );
  }

  function folderOf(path) {
    return String(path || "").slice(0, String(path || "").lastIndexOf("/"));
  }

  function nextIndex(images) {
    var max = 0;
    (images || []).forEach(function (path) {
      var match = String(path || "").match(/-(\d+)\.[a-z0-9]+$/i);
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    return max + 1;
  }

  function albumsFromData() {
    var out = [];

    if (typeof siteData === "undefined" || !Array.isArray(siteData.projects)) {
      return out;
    }

    siteData.projects.forEach(function (project, index) {
      if (!project || !Array.isArray(project.images) || !project.images.length) {
        return;
      }

      out.push({
        index: index,
        name: project.album || project.title || "Album " + (index + 1),
        folder: folderOf(project.images[0]),
        count: project.images.length,
      });
    });

    return out;
  }

  function populateAlbums() {
    var select = $("albumSelect");
    var albums = albumsFromData();
    select.innerHTML = "";

    if (!albums.length) {
      var empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "(belum ada album)";
      select.appendChild(empty);
      return;
    }

    albums.forEach(function (album) {
      var option = document.createElement("option");
      option.value = album.name;
      option.textContent = album.name + " (" + album.count + " gambar)";
      select.appendChild(option);
    });
  }

  function setAuthenticated(authenticated, username) {
    $("loginCard").hidden = authenticated;
    $("adminApp").hidden = !authenticated;
    $("sessionBar").hidden = !authenticated;

    if (authenticated) {
      $("sessionUser").textContent = username || "admin";
      populateAlbums();
    }
  }

  function checkSession() {
    setStatus("loginStatus", "Checking session…");

    apiJson(API.session)
      .then(function (result) {
        if (!result.configured) {
          setAuthenticated(false);
          $("loginButton").disabled = true;
          setStatus(
            "loginStatus",
            "Admin belum dikonfigurasi di Vercel environment variables.",
            "err"
          );
          return;
        }

        if (result.authenticated) {
          setStatus("loginStatus", "");
          setAuthenticated(true, result.username);
          return;
        }

        setAuthenticated(false);
        setStatus("loginStatus", "");
      })
      .catch(function () {
        setAuthenticated(false);
        setStatus("loginStatus", "Tidak bisa mengecek session.", "err");
      });
  }

  function login() {
    var username = $("usernameInput").value.trim();
    var password = $("passwordInput").value;
    var button = $("loginButton");

    if (!username || !password) {
      setStatus("loginStatus", "Username dan password wajib diisi.", "err");
      return;
    }

    button.disabled = true;
    setStatus("loginStatus", "Checking…");

    apiJson(API.login, {
      method: "POST",
      body: JSON.stringify({ username: username, password: password }),
    })
      .then(function (result) {
        $("passwordInput").value = "";
        setStatus("loginStatus", "");
        setAuthenticated(true, result.username);
      })
      .catch(function (error) {
        setStatus("loginStatus", error.message || "Login gagal.", "err");
      })
      .finally(function () {
        button.disabled = false;
      });
  }

  function logout() {
    apiJson(API.logout, {
      method: "POST",
      body: "{}",
    })
      .catch(function () {
        return null;
      })
      .finally(function () {
        setAuthenticated(false);
        $("passwordInput").value = "";
        setStatus("loginStatus", "");
      });
  }

  function busy(button, on, label) {
    if (on) {
      button.dataset.label = button.textContent;
      button.textContent = label || "Memproses…";
      button.disabled = true;
      return;
    }

    button.disabled = false;
    if (button.dataset.label) {
      button.textContent = button.dataset.label;
      delete button.dataset.label;
    }
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var image = new Image();

      image.onload = function () {
        URL.revokeObjectURL(url);
        resolve(image);
      };

      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("Gagal membaca " + file.name + "."));
      };

      image.src = url;
    });
  }

  function compressImage(file) {
    return loadImage(file).then(function (image) {
      var width = image.naturalWidth || image.width;
      var height = image.naturalHeight || image.height;
      var maxWidth = 1500;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      var canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(image, 0, 0, width, height);

      return new Promise(function (resolve, reject) {
        canvas.toBlob(
          function (blob) {
            if (blob) {
              resolve({ blob: blob, extension: "webp" });
              return;
            }

            canvas.toBlob(
              function (jpeg) {
                if (!jpeg) {
                  reject(new Error("Gagal mengompres " + file.name + "."));
                  return;
                }
                resolve({ blob: jpeg, extension: "jpg" });
              },
              "image/jpeg",
              0.85
            );
          },
          "image/webp",
          0.82
        );
      });
    });
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || "").split(",")[1] || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function uploadOne(file, options) {
    return compressImage(file)
      .then(function (output) {
        if (output.blob.size > 3 * 1024 * 1024) {
          throw new Error(file.name + " masih lebih besar dari 3 MB.");
        }

        return blobToBase64(output.blob).then(function (content) {
          return apiJson(API.upload, {
            method: "POST",
            body: JSON.stringify({
              filename: file.name,
              extension: output.extension,
              content: content,
              folder: options.folder,
              baseName: options.baseName || "",
              index: options.index || 0,
            }),
          });
        });
      })
      .then(function (result) {
        return result.path;
      });
  }

  function uploadFiles(files, options, statusId) {
    var paths = [];
    var chain = Promise.resolve();

    files.forEach(function (file, index) {
      chain = chain.then(function () {
        setStatus(
          statusId,
          "Upload " + (index + 1) + "/" + files.length + ": " + file.name
        );

        return uploadOne(file, {
          folder: options.folder,
          baseName: options.baseName,
          index: options.startIndex ? options.startIndex + index : 0,
        }).then(function (path) {
          paths.push(path);
        });
      });
    });

    return chain.then(function () {
      return paths;
    });
  }

  function addFilm() {
    var title = $("filmTitle").value.trim();
    var rating = $("filmRating").value;
    var button = $("addFilmButton");

    if (!title) {
      setStatus("filmStatus", "Judul film masih kosong.", "err");
      return;
    }

    busy(button, true);
    setStatus("filmStatus", "Menyimpan…");

    apiJson(API.content, {
      method: "POST",
      body: JSON.stringify({
        action: "addFilm",
        title: title,
        rating: rating,
      }),
    })
      .then(function (result) {
        if (typeof siteData !== "undefined") {
          if (!Array.isArray(siteData.films)) siteData.films = [];
          siteData.films.unshift(result.entry);
        }

        $("filmTitle").value = "";
        setStatus("filmStatus", "Film berhasil dipublish.", "ok");
      })
      .catch(function (error) {
        setStatus("filmStatus", error.message || "Gagal menyimpan film.", "err");
      })
      .finally(function () {
        busy(button, false);
      });
  }

  function selectedMode() {
    var active = document.querySelector(".mode-btn.active[data-mode]");
    return active ? active.getAttribute("data-mode") : "existing";
  }

  function uploadImages() {
    var files = Array.prototype.slice.call($("imageFiles").files || []);
    var button = $("uploadButton");
    var mode = selectedMode();

    if (!files.length) {
      setStatus("imageStatus", "Belum ada gambar dipilih.", "err");
      return;
    }

    busy(button, true);
    setStatus("imageStatus", "Menyiapkan gambar…");

    var job;

    if (mode === "loose") {
      job = uploadFiles(
        files,
        { folder: "assets/img", baseName: "", startIndex: 0 },
        "imageStatus"
      ).then(function () {
        return { kind: "loose" };
      });
    } else if (mode === "new") {
      var name = $("newAlbumName").value.trim();

      if (!name) {
        busy(button, false);
        setStatus("imageStatus", "Nama album baru masih kosong.", "err");
        return;
      }

      var slug = slugify(name);
      job = uploadFiles(
        files,
        {
          folder: "assets/img/" + slug,
          baseName: slug,
          startIndex: 1,
        },
        "imageStatus"
      ).then(function (paths) {
        return apiJson(API.content, {
          method: "POST",
          body: JSON.stringify({
            action: "newAlbum",
            name: name,
            paths: paths,
          }),
        }).then(function () {
          if (typeof siteData !== "undefined") {
            if (!Array.isArray(siteData.projects)) siteData.projects = [];
            siteData.projects.unshift({
              album: name,
              role: "Design",
              cover: paths[0],
              images: paths.slice(),
            });
          }
          return { kind: "new", name: name };
        });
      });
    } else {
      var chosen = $("albumSelect").value;
      var album = albumsFromData().filter(function (item) {
        return item.name === chosen;
      })[0];

      if (!album) {
        busy(button, false);
        setStatus("imageStatus", "Album tidak valid.", "err");
        return;
      }

      var project = siteData.projects[album.index];
      var baseName = album.folder.split("/").pop();

      job = uploadFiles(
        files,
        {
          folder: album.folder,
          baseName: baseName,
          startIndex: nextIndex(project.images),
        },
        "imageStatus"
      ).then(function (paths) {
        return apiJson(API.content, {
          method: "POST",
          body: JSON.stringify({
            action: "addAlbumImages",
            albumName: album.name,
            paths: paths,
          }),
        }).then(function () {
          paths.forEach(function (path) {
            project.images.push(path);
          });
          return { kind: "existing" };
        });
      });
    }

    job
      .then(function () {
        $("imageFiles").value = "";
        $("newAlbumName").value = "";
        populateAlbums();
        setStatus("imageStatus", "Gambar berhasil dipublish.", "ok");
      })
      .catch(function (error) {
        setStatus("imageStatus", error.message || "Upload gagal.", "err");
      })
      .finally(function () {
        busy(button, false);
      });
  }

  function setMode(mode) {
    document.querySelectorAll(".mode-btn[data-mode]").forEach(function (button) {
      button.classList.toggle(
        "active",
        button.getAttribute("data-mode") === mode
      );
    });

    $("existingAlbumFields").hidden = mode !== "existing";
    $("newAlbumFields").hidden = mode !== "new";
  }

  function wire() {
    $("loginButton").addEventListener("click", login);
    $("passwordInput").addEventListener("keydown", function (event) {
      if (event.key === "Enter") login();
    });
    $("usernameInput").addEventListener("keydown", function (event) {
      if (event.key === "Enter") $("passwordInput").focus();
    });

    $("logoutButton").addEventListener("click", logout);
    $("addFilmButton").addEventListener("click", addFilm);
    $("uploadButton").addEventListener("click", uploadImages);

    document.querySelectorAll(".mode-btn[data-mode]").forEach(function (button) {
      button.addEventListener("click", function () {
        setMode(button.getAttribute("data-mode"));
      });
    });

    setMode("existing");
    checkSession();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
