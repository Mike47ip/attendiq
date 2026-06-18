// server/index.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { json } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import { PrismaPg } from "@prisma/adapter-pg";
import {
  RekognitionClient,
  CreateCollectionCommand,
  IndexFacesCommand,
  SearchFacesByImageCommand,
  DeleteFacesCommand,
} from "@aws-sdk/client-rekognition";

const app = express();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ORIGIN      = process.env.ORIGIN   || "https://localhost:5173";
const JWT_SECRET  = process.env.JWT_SECRET;
const FACE_TOKEN_EXPIRY = "10m";
const GPS_TOKEN_EXPIRY  = "10m";
const COLLECTION_ID     = "attendiq-faces";

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION || "eu-west-1",
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

app.use(helmet());
app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(json({ limit: "10mb" }));

// ── Rekognition helpers ────────────────────────────────────────────────────

async function ensureCollection() {
  try {
    await rekognition.send(new CreateCollectionCommand({ CollectionId: COLLECTION_ID }));
  } catch (err) {
    if (err.name !== "ResourceAlreadyExistsException") throw err;
  }
}

// ── Middleware ─────────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  });
}

function requireSuperAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "superadmin") {
      return res.status(403).json({ message: "Superadmin access required" });
    }
    next();
  });
}

// Get tenantId from token — superadmin can pass ?tenantId= to scope queries
function getTenantId(req) {
  if (req.user.role === "superadmin") {
    return req.query.tenantId || req.body.tenantId || null;
  }
  return req.user.tenantId;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getAttendanceStatus(clockInTime) {
  const [h, m] = clockInTime.split(":").map(Number);
  return h > 9 || (h === 9 && m > 5) ? "late" : "on-time";
}

// ══════════════════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════════════════

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, tenantSlug } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { office: true, tenant: true },
    });

    if (!user || !user.password) return res.status(401).json({ message: "Invalid email or password" });

    // Superadmin — no tenant check
    if (user.role === "superadmin") {
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ message: "Invalid email or password" });
      const token = jwt.sign({ userId: user.id, role: user.role, tenantId: null }, JWT_SECRET, { expiresIn: "8h" });
      return res.json({
        token,
        user: {
          id: user.id, name: user.name, email: user.email,
          role: user.role, tenantId: null,
          avatarInitials: user.avatarInitials, color: user.color,
        },
      });
    }

    // Tenant user — verify tenant slug matches
    if (tenantSlug) {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (!tenant) return res.status(404).json({ message: "Company not found" });
      if (!tenant.isActive) return res.status(403).json({ message: "This company account is inactive. Please contact support." });
      if (user.tenantId !== tenant.id) return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check tenant is active
    if (user.tenant && !user.tenant.isActive) {
      return res.status(403).json({ message: "Your company account is inactive. Please contact support." });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Invalid email or password" });

    const token = jwt.sign(
      { userId: user.id, role: user.role, tenantId: user.tenantId },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      user: {
        id: user.id, name: user.name, email: user.email,
        role: user.role, dept: user.dept,
        avatarInitials: user.avatarInitials, color: user.color,
        officeId: user.officeId,
        tenantId: user.tenantId,
        tenantName: user.tenant?.name,
        faceRegistered: user.faceRegistered,
        office: user.office ? {
          id: user.office.id, name: user.office.name,
          lat: user.office.lat, lng: user.office.lng,
          radiusMetres: user.office.radiusMetres,
        } : null,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// SUPERADMIN — TENANT MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════

// Get all tenants
app.get("/api/superadmin/tenants", requireSuperAdmin, async (req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { users: true, offices: true, attendance: true } },
      },
    });
    res.json({ tenants });
  } catch (err) { res.status(500).json({ message: "Failed to fetch tenants" }); }
});

// Create new tenant
app.post("/api/superadmin/tenants", requireSuperAdmin, async (req, res) => {
  try {
    const { name, slug, adminName, adminEmail, adminPassword } = req.body;
    if (!name || !slug || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({ message: "All fields required" });
    }

    // Check slug is unique
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) return res.status(409).json({ message: "Company slug already exists" });

    // Check email is unique
    const existingUser = await prisma.user.findUnique({ where: { email: adminEmail.toLowerCase() } });
    if (existingUser) return res.status(409).json({ message: "Email already exists" });

    const hashed = await bcrypt.hash(adminPassword, 10);

    // Create tenant + admin in transaction
    const tenant = await prisma.$transaction(async (tx) => {
      const t = await tx.tenant.create({
        data: { name, slug: slug.toLowerCase().replace(/\s+/g, "-"), isActive: true },
      });
      await tx.user.create({
        data: {
          tenantId: t.id,
          name: adminName,
          email: adminEmail.toLowerCase(),
          password: hashed,
          role: "admin",
          dept: "Management",
          avatarInitials: adminName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2),
          color: "#6366f1",
        },
      });
      return t;
    });

    res.status(201).json({ tenant });
  } catch (err) {
    console.error("Create tenant error:", err);
    res.status(500).json({ message: "Failed to create company" });
  }
});

// Toggle tenant active status
app.patch("/api/superadmin/tenants/:id/toggle", requireSuperAdmin, async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    const updated = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { isActive: !tenant.isActive },
    });
    res.json({ tenant: updated });
  } catch (err) { res.status(500).json({ message: "Failed to update tenant" }); }
});

// Delete tenant
app.delete("/api/superadmin/tenants/:id", requireSuperAdmin, async (req, res) => {
  try {
    await prisma.tenant.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: "Failed to delete tenant" }); }
});

// Platform-wide stats
app.get("/api/superadmin/stats", requireSuperAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const [totalTenants, activeTenants, totalUsers, totalCheckInsToday] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: { not: "superadmin" } } }),
      prisma.attendance.count({ where: { date: today } }),
    ]);
    res.json({ totalTenants, activeTenants, totalUsers, totalCheckInsToday });
  } catch (err) { res.status(500).json({ message: "Failed to fetch stats" }); }
});

// ══════════════════════════════════════════════════════════════════════════
// FACE RECOGNITION
// ══════════════════════════════════════════════════════════════════════════

app.post("/api/auth/face/register", async (req, res) => {
  try {
    const { userId, imageBase64 } = req.body;
    if (!userId || !imageBase64) return res.status(400).json({ message: "userId and imageBase64 required" });

    await ensureCollection();

    const imageBuffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
    const result = await rekognition.send(new IndexFacesCommand({
      CollectionId: COLLECTION_ID,
      Image: { Bytes: imageBuffer },
      ExternalImageId: userId,
      DetectionAttributes: [],
      MaxFaces: 1,
      QualityFilter: "AUTO",
    }));

    if (!result.FaceRecords || result.FaceRecords.length === 0) {
      return res.status(400).json({ message: "No face detected. Please look directly at the camera in good lighting." });
    }

    const faceId = result.FaceRecords[0].Face.FaceId;
    await prisma.user.update({
      where: { id: userId },
      data: { azureFaceId: faceId, faceRegistered: true },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Face register error:", err);
    res.status(500).json({ message: err.message || "Failed to register face" });
  }
});

app.post("/api/auth/face/verify", async (req, res) => {
  try {
    const { userId, imageBase64 } = req.body;
    if (!userId || !imageBase64) return res.status(400).json({ message: "userId and imageBase64 required" });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.azureFaceId || !user.faceRegistered) {
      return res.status(400).json({ message: "No face registered for this user" });
    }

    const imageBuffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
    const result = await rekognition.send(new SearchFacesByImageCommand({
      CollectionId: COLLECTION_ID,
      Image: { Bytes: imageBuffer },
      MaxFaces: 1,
      FaceMatchThreshold: 80,
      QualityFilter: "AUTO",
    }));

    if (!result.FaceMatches || result.FaceMatches.length === 0) {
      return res.status(401).json({ verified: false, message: "Face did not match. Please try again." });
    }

    const match = result.FaceMatches[0];
    if (match.Face.ExternalImageId !== userId || match.Similarity < 80) {
      return res.status(401).json({ verified: false, message: "Face did not match. Please try again." });
    }

    const faceToken = jwt.sign({ userId, faceVerified: true }, JWT_SECRET, { expiresIn: FACE_TOKEN_EXPIRY });
    res.json({ verified: true, faceToken, confidence: match.Similarity });
  } catch (err) {
    console.error("Face verify error:", err);
    if (err.name === "InvalidParameterException") {
      return res.status(401).json({ verified: false, message: "No face detected. Look directly at the camera in good lighting." });
    }
    res.status(500).json({ message: err.message || "Face verification failed" });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// ADMIN — USERS (tenant-scoped)
// ══════════════════════════════════════════════════════════════════════════

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const where = tenantId ? { tenantId } : {};
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, email: true, role: true,
        dept: true, color: true, avatarInitials: true,
        officeId: true, office: { select: { name: true } },
        faceRegistered: true, tenantId: true, createdAt: true,
      },
    });
    res.json({ users });
  } catch (err) { res.status(500).json({ message: "Failed to fetch users" }); }
});

app.post("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ message: "tenantId required" });

    const { name, email, password, role, dept, officeId, color, avatarInitials } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password required" });

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return res.status(409).json({ message: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        tenantId, name, email: email.toLowerCase(), password: hashed,
        role: role || "staff", dept: dept || "General",
        officeId: officeId || null, color: color || "#6366f1",
        avatarInitials: avatarInitials || name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2),
      },
    });
    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error("Create user error:", err);
    res.status(500).json({ message: "Failed to create user" });
  }
});

app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: "Failed to delete user" }); }
});

app.delete("/api/admin/users/:id/face", requireAdmin, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (user?.azureFaceId) {
      try {
        await rekognition.send(new DeleteFacesCommand({ CollectionId: COLLECTION_ID, FaceIds: [user.azureFaceId] }));
      } catch (e) { console.warn("AWS delete face warning:", e.message); }
    }
    await prisma.user.update({ where: { id: req.params.id }, data: { azureFaceId: null, faceRegistered: false } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: "Failed to reset face" }); }
});

// ══════════════════════════════════════════════════════════════════════════
// ADMIN — OFFICES (tenant-scoped)
// ══════════════════════════════════════════════════════════════════════════

app.get("/api/admin/offices", requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const where = tenantId ? { tenantId } : {};
    const offices = await prisma.office.findMany({
      where,
      include: { _count: { select: { users: true } } },
      orderBy: { name: "asc" },
    });
    res.json({ offices });
  } catch (err) { res.status(500).json({ message: "Failed to fetch offices" }); }
});

app.post("/api/admin/offices", requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ message: "tenantId required" });

    const { name, lat, lng, radiusMetres } = req.body;
    if (!name || !lat || !lng) return res.status(400).json({ message: "Name, lat and lng required" });

    const office = await prisma.office.create({
      data: { tenantId, name, lat: parseFloat(lat), lng: parseFloat(lng), radiusMetres: parseInt(radiusMetres) || 150 },
    });
    res.status(201).json({ office });
  } catch (err) { res.status(500).json({ message: "Failed to create office" }); }
});

app.put("/api/admin/offices/:id", requireAdmin, async (req, res) => {
  try {
    const { name, lat, lng, radiusMetres } = req.body;
    const office = await prisma.office.update({
      where: { id: req.params.id },
      data: { name, lat: parseFloat(lat), lng: parseFloat(lng), radiusMetres: parseInt(radiusMetres) },
    });
    res.json({ office });
  } catch (err) { res.status(500).json({ message: "Failed to update office" }); }
});

app.delete("/api/admin/offices/:id", requireAdmin, async (req, res) => {
  try {
    await prisma.office.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: "Failed to delete office" }); }
});

// ══════════════════════════════════════════════════════════════════════════
// ADMIN — STATS + ATTENDANCE (tenant-scoped)
// ══════════════════════════════════════════════════════════════════════════

app.get("/api/admin/stats/today", requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const today = new Date().toISOString().split("T")[0];
    const where = tenantId ? { tenantId } : {};
    const total = await prisma.user.count({ where: { ...where, role: "staff" } });
    const records = await prisma.attendance.findMany({ where: { ...where, date: today } });
    const onTime = records.filter(r => r.status === "on-time").length;
    const late   = records.filter(r => r.status === "late").length;
    res.json({ total, onTime, late, absent: total - records.length });
  } catch (err) { res.status(500).json({ message: "Failed to fetch stats" }); }
});

app.get("/api/admin/attendance", requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { startDate, endDate, userId } = req.query;
    const where = tenantId ? { tenantId } : {};
    if (startDate && endDate) where.date = { gte: startDate, lte: endDate };
    if (userId) where.userId = userId;
    const records = await prisma.attendance.findMany({
      where,
      include: { user: { select: { name: true, dept: true, color: true, avatarInitials: true } } },
      orderBy: [{ date: "desc" }, { clockIn: "desc" }],
    });
    res.json({ records });
  } catch (err) { res.status(500).json({ message: "Failed to fetch attendance" }); }
});

// ══════════════════════════════════════════════════════════════════════════
// ADMIN — LEADERBOARD (tenant-scoped)
// ══════════════════════════════════════════════════════════════════════════

app.get("/api/admin/leaderboard", requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ message: "startDate and endDate required" });

    const where = tenantId ? { tenantId } : {};
    const users = await prisma.user.findMany({
      where: { ...where, role: "staff" },
      select: { id: true, name: true, dept: true, color: true, avatarInitials: true },
    });
    const records = await prisma.attendance.findMany({ where: { ...where, date: { gte: startDate, lte: endDate } } });

    const start = new Date(startDate);
    const end   = new Date(endDate);
    let workingDays = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) workingDays++;
    }

    const leaderboard = users.map(user => {
      const userRecords = records.filter(r => r.userId === user.id);
      const onTimeCount = userRecords.filter(r => r.status === "on-time").length;
      const lateCount   = userRecords.filter(r => r.status === "late").length;
      return { userId: user.id, name: user.name, dept: user.dept, color: user.color, avatarInitials: user.avatarInitials, onTimeCount, lateCount, totalDays: userRecords.length };
    }).sort((a, b) => b.onTimeCount !== a.onTimeCount ? b.onTimeCount - a.onTimeCount : a.lateCount - b.lateCount);

    res.json({ leaderboard, totalStaff: users.length, workingDays, perfectAttendance: leaderboard.filter(s => s.totalDays === workingDays && s.lateCount === 0).length });
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ message: "Failed to fetch leaderboard" });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// ADMIN — ANALYTICS (tenant-scoped)
// ══════════════════════════════════════════════════════════════════════════

app.get("/api/admin/analytics", requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ message: "startDate and endDate required" });

    const where = tenantId ? { tenantId } : {};
    const users = await prisma.user.findMany({ where: { ...where, role: "staff" }, select: { id: true, dept: true } });
    const records = await prisma.attendance.findMany({ where: { ...where, date: { gte: startDate, lte: endDate } } });

    const totalStaff    = users.length;
    const totalCheckIns = records.length;
    const totalOnTime   = records.filter(r => r.status === "on-time").length;
    const totalLate     = records.filter(r => r.status === "late").length;

    const start = new Date(startDate);
    const end   = new Date(endDate);
    let workingDays = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) workingDays++;
    }

    const totalExpected  = totalStaff * workingDays;
    const totalAbsent    = Math.max(0, totalExpected - totalCheckIns);
    const attendanceRate = totalExpected > 0 ? Math.round((totalOnTime / totalExpected) * 100) : 0;

    const dailyMap = {};
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      dailyMap[dateStr] = { date: dateStr, label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), onTime: 0, late: 0, absent: totalStaff };
    }
    records.forEach(r => {
      if (dailyMap[r.date]) {
        if (r.status === "on-time") dailyMap[r.date].onTime++;
        else if (r.status === "late") dailyMap[r.date].late++;
        dailyMap[r.date].absent--;
      }
    });

    const total = totalOnTime + totalLate + totalAbsent;
    const pieData = [
      { name: "On Time", value: totalOnTime, fill: "#4ade80", percent: total > 0 ? Math.round((totalOnTime / total) * 100) : 0 },
      { name: "Late",    value: totalLate,   fill: "#fb923c", percent: total > 0 ? Math.round((totalLate / total) * 100) : 0 },
      { name: "Absent",  value: totalAbsent, fill: "#f87171", percent: total > 0 ? Math.round((totalAbsent / total) * 100) : 0 },
    ];

    const deptMap = {};
    users.forEach(u => { if (!deptMap[u.dept]) deptMap[u.dept] = { total: 0, onTime: 0 }; deptMap[u.dept].total += workingDays; });
    records.forEach(r => { const u = users.find(u => u.id === r.userId); if (u && deptMap[u.dept] && r.status === "on-time") deptMap[u.dept].onTime++; });
    const deptData = Object.entries(deptMap).map(([dept, { total, onTime }]) => ({ dept, total, onTime, onTimeRate: total > 0 ? Math.round((onTime / total) * 100) : 0 })).sort((a, b) => b.onTimeRate - a.onTimeRate);

    res.json({ summary: { totalCheckIns, totalOnTime, totalLate, totalAbsent, workingDays, attendanceRate }, dailyData: Object.values(dailyMap), pieData, deptData });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// GPS VALIDATION
// ══════════════════════════════════════════════════════════════════════════

app.post("/api/attendance/validate-gps", async (req, res) => {
  try {
    const { lat, lng, accuracy, userId, faceToken } = req.body;
    if (!lat || !lng || !userId) return res.status(400).json({ message: "Missing required fields" });

    try { jwt.verify(faceToken, JWT_SECRET); } catch {
      return res.status(403).json({ message: "Face verification expired. Please verify your face first." });
    }

    if (accuracy > 150) return res.status(400).json({ valid: false, message: `GPS accuracy too low (±${accuracy}m). Move to open area.` });

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { office: true } });
    if (!user?.office) return res.status(404).json({ message: "No office assigned to this user" });

    const { office } = user;
    const distance = haversineDistance(lat, lng, office.lat, office.lng);
    const effectiveDistance = distance + accuracy;

    if (effectiveDistance > office.radiusMetres) {
      return res.status(403).json({ valid: false, distance: Math.round(distance), message: `Too far from ${office.name} (${Math.round(distance)}m away, ${office.radiusMetres}m allowed)` });
    }

    const gpsToken = jwt.sign(
      { userId, officeId: office.id, lat, lng, accuracy, distance: Math.round(distance), gpsVerified: true, faceVerified: true },
      JWT_SECRET,
      { expiresIn: GPS_TOKEN_EXPIRY }
    );

    res.json({ valid: true, gpsToken, distance: Math.round(distance), officeName: office.name });
  } catch (err) {
    console.error("GPS validation error:", err);
    res.status(500).json({ message: "GPS validation failed" });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// ATTENDANCE (tenant-scoped)
// ══════════════════════════════════════════════════════════════════════════

app.post("/api/attendance/clock-in", async (req, res) => {
  try {
    const { userId, gpsToken } = req.body;
    let payload;
    try { payload = jwt.verify(gpsToken, JWT_SECRET); } catch {
      return res.status(403).json({ message: "Session expired. Please start over." });
    }

    if (!payload.gpsVerified || !payload.faceVerified) {
      return res.status(403).json({ message: "Face and GPS verification both required" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: "User not found" });

    const today = new Date().toISOString().split("T")[0];
    const clockInTime = new Date().toTimeString().slice(0, 5);

    const existing = await prisma.attendance.findFirst({ where: { userId, date: today } });
    if (existing) return res.status(409).json({ message: "You have already clocked in today", record: existing });

    const record = await prisma.attendance.create({
      data: {
        tenantId: user.tenantId,
        userId, date: today, clockIn: clockInTime,
        status: getAttendanceStatus(clockInTime),
        lat: payload.lat, lng: payload.lng, accuracy: payload.accuracy,
        gpsVerified: true, faceVerified: true, officeId: payload.officeId,
      },
    });
    res.json(record);
  } catch (err) {
    console.error("Clock-in error:", err);
    res.status(500).json({ message: "Clock-in failed" });
  }
});

app.post("/api/attendance/clock-out", async (req, res) => {
  try {
    const { userId } = req.body;
    const today = new Date().toISOString().split("T")[0];
    const record = await prisma.attendance.findFirst({ where: { userId, date: today } });
    if (!record) return res.status(404).json({ message: "No clock-in record found for today" });
    if (record.clockOut) return res.status(409).json({ message: "Already clocked out" });
    const updated = await prisma.attendance.update({
      where: { id: record.id },
      data: { clockOut: new Date().toTimeString().slice(0, 5) },
    });
    res.json(updated);
  } catch (err) {
    console.error("Clock-out error:", err);
    res.status(500).json({ message: "Clock-out failed" });
  }
});

app.get("/api/attendance/today/:userId", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const record = await prisma.attendance.findFirst({ where: { userId: req.params.userId, date: today } });
    res.json({ record: record || null });
  } catch (err) { res.status(500).json({ message: "Failed to fetch record" }); }
});

app.get("/api/attendance/history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    const where = { userId };
    if (startDate && endDate) where.date = { gte: startDate, lte: endDate };
    const records = await prisma.attendance.findMany({ where, orderBy: { date: "desc" } });
    res.json({ records });
  } catch (err) { res.status(500).json({ message: "Failed to fetch history" }); }
});

// ── Start ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`AttendIQ server running on port ${PORT}`);
  console.log(`Origin: ${ORIGIN}`);
  console.log(`AWS Region: ${process.env.AWS_REGION}`);
});