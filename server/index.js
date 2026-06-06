// server/index.js

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { json } from "express";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

dotenv.config();

const app = express();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const RP_NAME = "AttendIQ";
const RP_ID   = process.env.RP_ID   || "localhost";
const ORIGIN  = process.env.ORIGIN  || "https://localhost:5173";
const JWT_SECRET = process.env.JWT_SECRET;
const GPS_TOKEN_EXPIRY     = "3m";
const SESSION_TOKEN_EXPIRY = "1h";

app.use(helmet());
app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(json());

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
// ADMIN
// ══════════════════════════════════════════════════════════════════════════

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, email: true, role: true,
        dept: true, color: true, avatarInitials: true,
        officeId: true, office: { select: { name: true } }, createdAt: true,
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
// GPS VALIDATION
// ══════════════════════════════════════════════════════════════════════════

app.post("/api/attendance/validate-gps", async (req, res) => {
  try {
    const { lat, lng, accuracy, userId } = req.body;
    if (!lat || !lng || !userId) return res.status(400).json({ message: "Missing required fields" });
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
      { userId, officeId: office.id, lat, lng, accuracy, distance: Math.round(distance), gpsVerified: true },
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
// WEBAUTHN — @simplewebauthn/server v13
// ══════════════════════════════════════════════════════════════════════════

app.post("/api/auth/register/start", async (req, res) => {
  try {
    const { userId, userName } = req.body;
    const existingCredentials = await prisma.webAuthnCredential.findMany({ where: { userId } });

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: new TextEncoder().encode(userId),
      userName,
      attestationType: "none",
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      // v13: pass credentialId as raw base64url string, no Buffer, no type field
      excludeCredentials: existingCredentials.map(c => ({ id: c.credentialId })),
    });

    await prisma.webAuthnChallenge.upsert({
      where: { userId },
      update: { challenge: options.challenge, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
      create: { userId, challenge: options.challenge, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    });

    res.json(options);
  } catch (err) {
    console.error("Register start error:", err.message);
    res.status(500).json({ message: err.message || "Failed to generate registration options" });
  }
});

app.post("/api/auth/register/finish", async (req, res) => {
  try {
    const { userId, credential } = req.body;
    const challengeRecord = await prisma.webAuthnChallenge.findUnique({ where: { userId } });
    if (!challengeRecord || challengeRecord.expiresAt < new Date()) {
      return res.status(400).json({ message: "Challenge expired" });
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ message: "Registration failed" });
    }

    // v13: credential info is under registrationInfo.credential
    const { credential: cred, credentialDeviceType } = verification.registrationInfo;

    await prisma.webAuthnCredential.create({
      data: {
        userId,
        credentialId: Buffer.from(cred.id).toString("base64url"),
        publicKey:    Buffer.from(cred.publicKey).toString("base64url"),
        counter:      cred.counter,
        deviceType:   credentialDeviceType,
      },
    });

    await prisma.webAuthnChallenge.delete({ where: { userId } });
    res.json({ verified: true });
  } catch (err) {
    console.error("Register finish error:", err.message);
    res.status(500).json({ message: err.message || "Registration failed" });
  }
});

app.post("/api/auth/login/start", async (req, res) => {
  try {
    const { userId, gpsToken } = req.body;
    try { jwt.verify(gpsToken, JWT_SECRET); } catch {
      return res.status(403).json({ message: "GPS verification expired. Re-verify location." });
    }

    const credentials = await prisma.webAuthnCredential.findMany({ where: { userId } });
    if (credentials.length === 0) {
      return res.status(404).json({ message: "No biometric registered. Please register first." });
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: "required",
      // v13: pass credentialId as raw base64url string, no Buffer, no type field
      allowCredentials: credentials.map(c => ({ id: c.credentialId })),
    });

    await prisma.webAuthnChallenge.upsert({
      where: { userId },
      update: { challenge: options.challenge, expiresAt: new Date(Date.now() + 3 * 60 * 1000) },
      create: { userId, challenge: options.challenge, expiresAt: new Date(Date.now() + 3 * 60 * 1000) },
    });

    res.json(options);
  } catch (err) {
    console.error("Login start error:", err.message);
    res.status(500).json({ message: err.message || "Failed to generate auth options" });
  }
});

app.post("/api/auth/login/finish", async (req, res) => {
  try {
    const { userId, assertion, gpsToken } = req.body;
    let gpsPayload;
    try { gpsPayload = jwt.verify(gpsToken, JWT_SECRET); } catch {
      return res.status(403).json({ message: "GPS token expired. Re-verify location." });
    }

    const challengeRecord = await prisma.webAuthnChallenge.findUnique({ where: { userId } });
    if (!challengeRecord || challengeRecord.expiresAt < new Date()) {
      return res.status(400).json({ message: "Challenge expired" });
    }

    const credential = await prisma.webAuthnCredential.findFirst({
      where: { userId, credentialId: assertion.id },
    });
    if (!credential) return res.status(404).json({ message: "Credential not found" });

    // v13: use credential key instead of authenticator
    const verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
      credential: {
        id:        Buffer.from(credential.credentialId, "base64url"),
        publicKey: Buffer.from(credential.publicKey,    "base64url"),
        counter:   credential.counter,
      },
    });

    if (!verification.verified) return res.status(401).json({ message: "Biometric verification failed" });

    await prisma.webAuthnCredential.update({
      where: { id: credential.id },
      data:  { counter: verification.authenticationInfo.newCounter },
    });
    await prisma.webAuthnChallenge.delete({ where: { userId } });

    const sessionToken = jwt.sign(
      {
        userId, gpsVerified: true, biometricVerified: true,
        officeId: gpsPayload.officeId,
        lat: gpsPayload.lat, lng: gpsPayload.lng, accuracy: gpsPayload.accuracy,
      },
      JWT_SECRET,
      { expiresIn: SESSION_TOKEN_EXPIRY }
    );

    res.json({ verified: true, sessionToken });
  } catch (err) {
    console.error("Login finish error:", err.message);
    res.status(500).json({ message: err.message || "Authentication failed" });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// ATTENDANCE
// ══════════════════════════════════════════════════════════════════════════

app.post("/api/attendance/clock-in", async (req, res) => {
  try {
    const { userId, sessionToken } = req.body;
    let payload;
    try { payload = jwt.verify(sessionToken, JWT_SECRET); } catch {
      return res.status(403).json({ message: "Invalid or expired session token" });
    }
    if (!payload.gpsVerified || !payload.biometricVerified) {
      return res.status(403).json({ message: "GPS and biometric verification required" });
    }

    const today = new Date().toISOString().split("T")[0];
    const clockInTime = new Date().toTimeString().slice(0, 5);
    const existing = await prisma.attendance.findFirst({ where: { userId, date: today } });
    if (existing) return res.status(409).json({ message: "Already clocked in today", record: existing });

    const record = await prisma.attendance.create({
      data: {
        userId, date: today, clockIn: clockInTime,
        status: getAttendanceStatus(clockInTime),
        lat: payload.lat, lng: payload.lng, accuracy: payload.accuracy,
        gpsVerified: true, biometricVerified: true, officeId: payload.officeId,
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

app.get("/api/auth/device-status/:userId", async (req, res) => {
  try {
    const count = await prisma.webAuthnCredential.count({ where: { userId: req.params.userId } });
    res.json({ registered: count > 0 });
  } catch (err) { res.status(500).json({ message: "Failed to check device status" }); }
});

// ── Start ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`AttendIQ server running on port ${PORT}`);
  console.log(`RP_ID: ${RP_ID}`);
  console.log(`Origin: ${ORIGIN}`);
});