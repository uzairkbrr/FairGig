const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "dev-fairgig-secret";
const ALG = process.env.JWT_ALG || "HS256";

function parseBearer(req) {
  const h = req.headers.authorization || "";
  if (!h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7);
}

function authenticate(req, res, next) {
  const token = parseBearer(req);
  if (!token) return res.status(401).json({ error: "missing bearer token" });
  try {
    const claims = jwt.verify(token, SECRET, { algorithms: [ALG] });
    if (claims.type !== "access") return res.status(401).json({ error: "expected access token" });
    req.user = claims;
    next();
  } catch (e) {
    res.status(401).json({ error: `invalid token: ${e.message}` });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "not authenticated" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `requires role in ${JSON.stringify(roles)}` });
    }
    next();
  };
}

function optionalAuth(req, _res, next) {
  const token = parseBearer(req);
  if (!token) return next();
  try {
    req.user = jwt.verify(token, SECRET, { algorithms: [ALG] });
  } catch (_e) {}
  next();
}

module.exports = { authenticate, requireRole, optionalAuth };
