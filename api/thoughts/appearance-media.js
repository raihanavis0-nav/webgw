/* Public decorative media only; no unpublished story or arbitrary archive assets. */
const store = require("../../server/thoughts-store");
const activity = require("../../server/story-activity");
const TYPES = {gif:"image/gif",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",svg:"image/svg+xml"};
module.exports = async function handler(req,res) {
  if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({error:"Method not allowed"});}
  if(req.query && req.query.activity === "1"){
    try {
      const data=(await store.readPublicLibrary()).data || {};
      res.setHeader("Cache-Control","public, max-age=60, stale-while-revalidate=120");
      res.setHeader("X-Content-Type-Options","nosniff");
      return res.status(200).json({ updates:activity.feed(data,5) });
    } catch(error) {
      return res.status(502).json({error:"Writing updates temporarily unavailable"});
    }
  }
  const path = String(req.query && req.query.path || "");
  if (!/^assets\/thoughts\/[a-zA-Z0-9._/-]+\.(gif|png|jpg|jpeg|webp)$/i.test(path) || path.includes(".."))
    return res.status(400).json({error:"Invalid artwork path"});
  try {
    const data = (await store.readPublicLibrary()).data || {};
    const a = data.appearance || {};
    const permitted = [a.login && a.login.image,a.hero && a.hero.image,
      a.interface && a.interface.logo].filter(Boolean);
    if (!permitted.includes(path)) return res.status(404).json({error:"Artwork not found"});
    const result = await store.getRawFile(path);
    const ext = path.split(".").pop().toLowerCase();
    res.setHeader("Content-Type",TYPES[ext] || "application/octet-stream");
    res.setHeader("X-Content-Type-Options","nosniff");
    res.setHeader("Cache-Control","public, max-age=300");
    return res.status(200).send(result.buffer);
  }catch(e){
    return res.status(502).json({error:"Artwork temporarily unavailable"});
  }
};
