const admin = require("../../server/thoughts-admin");

module.exports = function handler(req, res) {
  admin.noStore(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!admin.requireSameOrigin(req, res)) return;

  admin.clearSessionCookie(res);
  return res.status(200).json({ ok: true });
};
