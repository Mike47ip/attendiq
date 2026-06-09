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

const ORIGIN      = process.env.ORIGIN    || "https://localhost:5173";
const JWT_SECRET  = process.env.JWT_SECRET;
const FACE_TOKEN_EXPIRY = "10m";
const GPS_TOKEN_EXPIRY  = "10m";
const COLLECTION_ID     = "attendiq-faces";

// AWS Rekognition client
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
    console.log("Created Rekognition collection:", COLLECTION_ID);
  } catch (err) {
    if (err.name === "ResourceAlreadyExistsException") {
      // Collection exists — fine
    } else {
      throw err;
    }
  }
}

// ── Auth helpers ───────────────────────────────────────────────────────────

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
    if (req.user.role !== "admin") return res.status(403).json({ message: "Admin access required" });
    next();
  });
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
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { office: true },
    });
    if (!user || !user.password) return res.status(401).json({ message: "Invalid email or password" });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Invalid email or password" });
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "8h" });
    res.json({
      token,
      user: {
        id: user.id, name: user.name, email: user.email,
        role: user.role, dept: user.dept,
        avatarInitials: user.avatarInitials, color: user.color,
        officeId: user.officeId,
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
// AWS REKOGNITION FACE RECOGNITION
// ══════════════════════════════════════════════════════════════════════════

app.post("/api/auth/face/register", async (req, res) => {
  try {
    const { userId, imageBase64 } = req.body;
    if (!userId || !imageBase64) {
      return res.status(400).json({ message: "userId and imageBase64 required" });
    }

    await ensureCollection();

    const imageBuffer = Buffer.from(
      imageBase64.replace(/^data:image\/\w+;base64,/, ""),
      "base64"
    );

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
    if (!userId || !imageBase64) {
      return res.status(400).json({ message: "userId and imageBase64 required" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.azureFaceId || !user.faceRegistered) {
      return res.status(400).json({ message: "No face registered for this user" });
    }

    const imageBuffer = Buffer.from(
      imageBase64.replace(/^data:image\/\w+;base64,/, ""),
      "base64"
    );

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

    if (match.Face.ExternalImageId !== userId) {
      return res.status(401).json({ verified: false, message: "Face did not match. Please try again." });
    }

    if (match.Similarity < 80) {
      return res.status(401).json({ verified: false, message: "Face did not match. Please try again." });
    }

    const faceToken = jwt.sign(
      { userId, faceVerified: true },
      JWT_SECRET,
      { expiresIn: FACE_TOKEN_EXPIRY }
    );

    res.json({ verified: true, faceToken, confidence: match.Similarity });
  } catch (err) {
    console.error("Face verify error:", err);
    if (err.name === "InvalidParameterException") {
      return res.status(401).json({ verified: false, message: "No face detected. Look directly at the camera in good lighting." });
    }
    res.status(500).json({ message: err.message || "Face verification failed" });
  }
});

app.delete("/api/admin/users/:id/face", requireAdmin, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (user?.azureFaceId) {
      try {
        await rekognition.send(new DeleteFacesCommand({
          CollectionId: COLLECTION_ID,
          FaceIds: [user.azureFaceId],
        }));
      } catch (e) {
        console.warn("AWS delete face warning:", e.message);
      }
    }
    await prisma.user.update({
      where: { id: req.params.id },
      data: { azureFaceId: null, faceRegistered: false },
    });
    res.json({ success: true, message: "Face reset. User must re-register on next login." });
  } catch (err) {
    res.status(500).json({ message: "Failed to reset face" });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// ADMIN — USERS
// ══════════════════════════════════════════════════════════════════════════

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, email: true, role: true,
        dept: true, color: true, avatarInitials: true,
        officeId: true, office: { select: { name: true } },
        faceRegistered: true, createdAt: true,
      },
    });
    res.json({ users });
  } catch (err) { res.status(500).json({ message: "Failed to fetch users" }); }
});

app.post("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const { name, email, password, role, dept, officeId, color, avatarInitials } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: "Name, email and password required" });
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return res.status(409).json({ message: "Email already exists" });
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name, email: email.toLowerCase(), password: hashed,
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

// ══════════════════════════════════════════════════════════════════════════
// ADMIN — OFFICES
// ══════════════════════════════════════════════════════════════════════════

app.get("/api/admin/offices", requireAdmin, async (req, res) => {
  try {
    const offices = await prisma.office.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { name: "asc" },
    });
    res.json({ offices });
  } catch (err) { res.status(500).json({ message: "Failed to fetch offices" }); }
});

app.post("/api/admin/offices", requireAdmin, async (req, res) => {
  try {
    const { name, lat, lng, radiusMetres } = req.body;
    if (!name || !lat || !lng) return res.status(400).json({ message: "Name, lat and lng required" });
    const office = await prisma.office.create({
      data: { name, lat: parseFloat(lat), lng: parseFloat(lng), radiusMetres: parseInt(radiusMetres) || 150 },
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
// ADMIN — STATS
// ══════════════════════════════════════════════════════════════════════════

app.get("/api/admin/stats/today", requireAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const total = await prisma.user.count({ where: { role: "staff" } });
    const records = await prisma.attendance.findMany({ where: { date: today } });
    const onTime = records.filter(r => r.status === "on-time").length;
    const late   = records.filter(r => r.status === "late").length;
    res.json({ total, onTime, late, absent: total - records.length });
  } catch (err) { res.status(500).json({ message: "Failed to fetch stats" }); }
});

app.get("/api/admin/attendance", requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;
    const where = {};
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
// ADMIN — LEADERBOARD
// ══════════════════════════════════════════════════════════════════════════

app.get("/api/admin/leaderboard", requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "startDate and endDate required" });
    }

    const users = await prisma.user.findMany({
      where: { role: "staff" },
      select: { id: true, name: true, dept: true, color: true, avatarInitials: true },
    });

    const records = await prisma.attendance.findMany({
      where: { date: { gte: startDate, lte: endDate } },
    });

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
      const totalDays   = userRecords.length;
      return { userId: user.id, name: user.name, dept: user.dept, color: user.color, avatarInitials: user.avatarInitials, onTimeCount, lateCount, totalDays };
    });

    leaderboard.sort((a, b) => {
      if (b.onTimeCount !== a.onTimeCount) return b.onTimeCount - a.onTimeCount;
      return a.lateCount - b.lateCount;
    });

    const perfectAttendance = leaderboard.filter(s => s.totalDays === workingDays && s.lateCount === 0).length;

    res.json({ leaderboard, totalStaff: users.length, workingDays, perfectAttendance, period: { startDate, endDate } });
  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ message: "Failed to fetch leaderboard" });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// ADMIN — ANALYTICS
// ══════════════════════════════════════════════════════════════════════════

app.get("/api/admin/analytics", requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "startDate and endDate required" });
    }

    const users = await prisma.user.findMany({
      where: { role: "staff" },
      select: { id: true, dept: true },
    });

    const records = await prisma.attendance.findMany({
      where: { date: { gte: startDate, lte: endDate } },
    });

    const totalStaff = users.length;
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

    // Daily data
    const dailyMap = {};
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr  = d.toISOString().split("T")[0];
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;
      dailyMap[dateStr] = {
        date: dateStr,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        onTime: 0, late: 0, absent: totalStaff,
      };
    }
    records.forEach(r => {
      if (dailyMap[r.date]) {
        if (r.status === "on-time") dailyMap[r.date].onTime++;
        else if (r.status === "late") dailyMap[r.date].late++;
        dailyMap[r.date].absent--;
      }
    });
    const dailyData = Object.values(dailyMap);

    // Pie data
    const total = totalOnTime + totalLate + totalAbsent;
    const pieData = [
      { name: "On Time", value: totalOnTime, fill: "#4ade80", percent: total > 0 ? Math.round((totalOnTime / total) * 100) : 0 },
      { name: "Late",    value: totalLate,   fill: "#fb923c", percent: total > 0 ? Math.round((totalLate / total) * 100) : 0 },
      { name: "Absent",  value: totalAbsent, fill: "#f87171", percent: total > 0 ? Math.round((totalAbsent / total) * 100) : 0 },
    ];

    // Dept breakdown
    const deptMap = {};
    users.forEach(u => {
      if (!deptMap[u.dept]) deptMap[u.dept] = { total: 0, onTime: 0 };
      deptMap[u.dept].total += workingDays;
    });
    records.forEach(r => {
      const user = users.find(u => u.id === r.userId);
      if (user && deptMap[user.dept] && r.status === "on-time") deptMap[user.dept].onTime++;
    });
    const deptData = Object.entries(deptMap)
      .map(([dept, { total, onTime }]) => ({ dept, total, onTime, onTimeRate: total > 0 ? Math.round((onTime / total) * 100) : 0 }))
      .sort((a, b) => b.onTimeRate - a.onTimeRate);

    res.json({ summary: { totalCheckIns, totalOnTime, totalLate, totalAbsent, workingDays, attendanceRate }, dailyData, pieData, deptData });
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
      return res.status(403).json({
        valid: false,
        distance: Math.round(distance),
        message: `Too far from ${office.name} (${Math.round(distance)}m away, ${office.radiusMetres}m allowed)`,
      });
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
// ATTENDANCE
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

    const today = new Date().toISOString().split("T")[0];
    const clockInTime = new Date().toTimeString().slice(0, 5);

    const existing = await prisma.attendance.findFirst({ where: { userId, date: today } });
    if (existing) return res.status(409).json({ message: "You have already clocked in today", record: existing });

    const record = await prisma.attendance.create({
      data: {
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