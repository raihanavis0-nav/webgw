const admin = require("../../server/thoughts-admin");

module.exports = function handler(req, res) {
  admin.noStore(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!admin.isConfigured()) {
    return res.status(200).json({
      configured: false,
      authenticated: false,
    });
  }

  const session = admin.sessionFromRequest(req);
  return res.status(200).json({
    configured: true,
    authenticated: Boolean(session),
    username: session ? session.u : null,
  });
};
