// server/middleware.js

import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

// ── requireAuth ────────────────────────────────────────────────────────────
// Verifies the Bearer token on every protected route.
// Attaches the decoded payload to req.user so downstream handlers can read
// userId, role, and tenantId without touching the DB.
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Session expired. Please sign in again." });
    }
    return res.status(401).json({ message: "Invalid token" });
  }
}

// ── requireAdmin ───────────────────────────────────────────────────────────
// Allows both admins (tenant-scoped) and superadmins through.
// Use on routes that manage users, offices, attendance within a tenant.
export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  });
}

// ── requireSuperAdmin ──────────────────────────────────────────────────────
// Only lets superadmins through.
// Use on routes that manage tenants or cross-tenant user data.
export function requireSuperAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ message: "Superadmin access required" });
    }
    next();
  });
}

// ── getTenantId ────────────────────────────────────────────────────────────
// Helper (not middleware) — resolves the correct tenantId for a request.
// Superadmins can pass ?tenantId= or tenantId in the body to scope queries.
// Regular users always get their own tenantId from the token.
export function getTenantId(req) {
  if (req.user.role === "superadmin") {
    return req.query.tenantId || req.body.tenantId || null;
  }
  return req.user.tenantId;
}

// ── requireSameTenant ─────────────────────────────────────────────────────
// Extra guard for admin routes that touch a specific user/resource.
// Ensures an admin can't edit users outside their own tenant.
// Superadmins bypass this check entirely.
export function requireSameTenant(targetTenantId, req, res) {
  if (req.user.role === "superadmin") return true;
  if (req.user.tenantId !== targetTenantId) {
    res.status(403).json({ message: "Cannot access resources outside your company" });
    return false;
  }
  return true;
}