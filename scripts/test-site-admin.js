const fs = require("fs");
const assert = require("assert");
const site = require("../server/site-admin");

const source = fs.readFileSync("js/data.js", "utf8");

const withFilm = site.addFilm(source, "Audit Test Film (4/5)");
assert(withFilm.includes('"Audit Test Film (4/5)"'));

const withAlbum = site.addNewAlbum(source, {
  name: "Audit Test Album",
  paths: ["assets/img/audit-test-album/audit-test-album-01.webp"],
});
assert(withAlbum.includes('"album": "Audit Test Album"'));
assert(
  withAlbum.includes(
    '"assets/img/audit-test-album/audit-test-album-01.webp"'
  )
);

const extendedExisting = site.addImagesToAlbum(source, "E-Sport Posters", [
  "assets/img/esport-posters/esport-posters-06.webp",
]);
assert(
  extendedExisting.includes(
    '"assets/img/esport-posters/esport-posters-06.webp"'
  )
);

const extendedNew = site.addImagesToAlbum(withAlbum, "Audit Test Album", [
  "assets/img/audit-test-album/audit-test-album-02.webp",
]);
assert(
  extendedNew.includes(
    '"assets/img/audit-test-album/audit-test-album-02.webp"'
  )
);

console.log("site-admin parser tests passed");
