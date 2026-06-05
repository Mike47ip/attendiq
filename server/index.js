// server/index.js

/**
 * Express backend for AttendIQ.
 * Handles: WebAuthn registration/auth, GPS validation, attendance recording.
 *
 * Install:
 *   npm install express @simplewebauthn/server jsonwebtoken
 *               prisma @prisma/client cors helmet dotenv
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { json } from "express";
import dotenv from "dotenv";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

dotenv.config();

const app = express();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const RP_NAME = "AttendIQ";
const RP_ID = process.env.RP_ID || "localhost";         // your domain in prod
const ORIGIN = process.env.ORIGIN || "https://localhost:5173";
const JWT_SECRET = process.env.JWT_SECRET;
const GPS_TOKEN_EXPIRY = "3m";   // GPS token valid 3 minutes
const SESSION_TOKEN_EXPIRY = "1h";

app.use(helmet());
app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(json());

// ── Haversine (server-side — this is the real validation) ──────────────────
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

// ═══════════════════════════════════════════════════════════════════════════
// GPS VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/attendance/validate-gps
 * Receives GPS coords from the device.
 * Server runs Haversine against the office location.
 * Issues a short-lived gpsToken if valid.
 */
app.post("/api/attendance/validate-gps", async (req, res) => {
  try {
    const { lat, lng, accuracy, userId } = req.body;

    if (!lat || !lng || !userId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Reject if accuracy is worse than 100m — too unreliable
    if (accuracy > 100) {
      return res.status(400).json({
        message: `GPS accuracy too low (±${accuracy}m). Move to an open area.`,
        valid: false,
      });
    }

    // Get the user's assigned office
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { office: true },
    });

    if (!user?.office) {
      return res.status(404).json({ message: "No office assigned to user" });
    }

    const { office } = user;

    // THE REAL HAVERSINE CHECK — runs on server, not client
    const distance = haversineDistance(lat, lng, office.lat, office.lng);

    // Add accuracy buffer — if accuracy is ±30m, we add that to the distance
    const effectiveDistance = distance + accuracy;

    if (effectiveDistance > office.radiusMetres) {
      return res.status(403).json({
        valid: false,
        distance: Math.round(distance),
        effectiveDistance: Math.round(effectiveDistance),
        message: `Too far from ${office.name} (${Math.round(distance)}m away, ${office.radiusMetres}m allowed)`,
      });
    }

    // Issue GPS token — expires in 3 minutes
    // Biometric step MUST complete before this expires
    const gpsToken = jwt.sign(
      {
        userId,
        officeId: office.id,
        lat,
        lng,
        accuracy,
        distance: Math.round(distance),
        gpsVerified: true,
      },
      JWT_SECRET,
      { expiresIn: GPS_TOKEN_EXPIRY }
    );

    return res.json({
      valid: true,
      gpsToken,
      distance: Math.round(distance),
      officeName: office.name,
    });
  } catch (err) {
    console.error("GPS validation error:", err);
    res.status(500).json({ message: "GPS validation failed" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// WEBAUTHN — REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/auth/register/start
 * Generates WebAuthn registration options.
 * Returns a challenge for the device to sign.
 */
app.post("/api/auth/register/start", async (req, res) => {
  try {
    const { userId, userName } = req.body;

    // Get existing credentials so we don't re-register the same device
    const existingCredentials = await prisma.webAuthnCredential.findMany({
      where: { userId },
    });

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: userId,
      userName: userName,
      attestationType: "none",
      authenticatorSelection: {
        // "platform" = built-in Face ID / Touch ID / Windows Hello
        authenticatorAttachment: "platform",
        userVerification: "required",   // must verify with biometric, not just presence
        residentKey: "preferred",
      },
      excludeCredentials: existingCredentials.map((c) => ({
        id: Buffer.from(c.credentialId, "base64url"),
        type: "public-key",
      })),
    });

    // Store the challenge temporarily — expires in 5 minutes
    await prisma.webAuthnChallenge.upsert({
      where: { userId },
      update: {
        challenge: options.challenge,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
      create: {
        userId,
        challenge: options.challenge,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    res.json(options);
  } catch (err) {
    console.error("Register start error:", err);
    res.status(500).json({ message: "Failed to generate registration options" });
  }
});

/**
 * POST /api/auth/register/finish
 * Verifies the signed registration response.
 * Stores the public key in the database.
 */
app.post("/api/auth/register/finish", async (req, res) => {
  try {
    const { userId, credential } = req.body;

    const challengeRecord = await prisma.webAuthnChallenge.findUnique({
      where: { userId },
    });

    if (!challengeRecord || challengeRecord.expiresAt < new Date()) {
      return res.status(400).json({ message: "Challenge expired. Please try again." });
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ message: "Registration verification failed" });
    }

    const { credentialPublicKey, credentialID, counter, credentialDeviceType } =
      verification.registrationInfo;

    // Store the public key — this is all we keep, no biometric data
    await prisma.webAuthnCredential.create({
      data: {
        userId,
        credentialId: Buffer.from(credentialID).toString("base64url"),
        publicKey: Buffer.from(credentialPublicKey).toString("base64url"),
        counter,
        deviceType: credentialDeviceType,
      },
    });

    // Clean up challenge
    await prisma.webAuthnChallenge.delete({ where: { userId } });

    res.json({ verified: true });
  } catch (err) {
    console.error("Register finish error:", err);
    res.status(500).json({ message: "Registration failed" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// WEBAUTHN — AUTHENTICATION (clock-in biometric step)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/auth/login/start
 * Issues a biometric challenge.
 * Only proceeds if the gpsToken is valid and not expired.
 */
app.post("/api/auth/login/start", async (req, res) => {
  try {
    const { userId, gpsToken } = req.body;

    // Verify GPS token — blocks biometric if GPS step wasn't done
    let gpsPayload;
    try {
      gpsPayload = jwt.verify(gpsToken, JWT_SECRET);
    } catch {
      return res.status(403).json({ message: "GPS verification expired or invalid. Please re-verify your location." });
    }

    if (gpsPayload.userId !== userId) {
      return res.status(403).json({ message: "Token mismatch" });
    }

    // Get registered credentials for this user
    const credentials = await prisma.webAuthnCredential.findMany({
      where: { userId },
    });

    if (credentials.length === 0) {
      return res.status(404).json({ message: "No biometric registered for this device. Please register first." });
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: "required",
      allowCredentials: credentials.map((c) => ({
        id: Buffer.from(c.credentialId, "base64url"),
        type: "public-key",
      })),
    });

    // Store challenge
    await prisma.webAuthnChallenge.upsert({
      where: { userId },
      update: {
        challenge: options.challenge,
        expiresAt: new Date(Date.now() + 3 * 60 * 1000),
      },
      create: {
        userId,
        challenge: options.challenge,
        expiresAt: new Date(Date.now() + 3 * 60 * 1000),
      },
    });

    res.json(options);
  } catch (err) {
    console.error("Login start error:", err);
    res.status(500).json({ message: "Failed to generate auth options" });
  }
});

/**
 * POST /api/auth/login/finish
 * Verifies the signed biometric assertion.
 * Issues a sessionToken used to record the attendance.
 */
app.post("/api/auth/login/finish", async (req, res) => {
  try {
    const { userId, assertion, gpsToken } = req.body;

    // Re-verify GPS token hasn't expired between steps
    let gpsPayload;
    try {
      gpsPayload = jwt.verify(gpsToken, JWT_SECRET);
    } catch {
      return res.status(403).json({ message: "GPS token expired. Please re-verify your location." });
    }

    const challengeRecord = await prisma.webAuthnChallenge.findUnique({
      where: { userId },
    });

    if (!challengeRecord || challengeRecord.expiresAt < new Date()) {
      return res.status(400).json({ message: "Challenge expired. Please try again." });
    }

    // Find the matching credential
    const credential = await prisma.webAuthnCredential.findFirst({
      where: {
        userId,
        credentialId: assertion.id,
      },
    });

    if (!credential) {
      return res.status(404).json({ message: "Credential not found" });
    }

    const verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
      authenticator: {
        credentialPublicKey: Buffer.from(credential.publicKey, "base64url"),
        credentialID: Buffer.from(credential.credentialId, "base64url"),
        counter: credential.counter,
      },
    });

    if (!verification.verified) {
      return res.status(401).json({ message: "Biometric verification failed" });
    }

    // Update counter — detects cloned authenticators
    await prisma.webAuthnCredential.update({
      where: { id: credential.id },
      data: { counter: verification.authenticationInfo.newCounter },
    });

    // Clean up challenge
    await prisma.webAuthnChallenge.delete({ where: { userId } });

    // Issue session token carrying both GPS + biometric proof
    const sessionToken = jwt.sign(
      {
        userId,
        gpsVerified: true,
        biometricVerified: true,
        officeId: gpsPayload.officeId,
        lat: gpsPayload.lat,
        lng: gpsPayload.lng,
        accuracy: gpsPayload.accuracy,
      },
      JWT_SECRET,
      { expiresIn: SESSION_TOKEN_EXPIRY }
    );

    res.json({ verified: true, sessionToken });
  } catch (err) {
    console.error("Login finish error:", err);
    res.status(500).json({ message: "Authentication failed" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ATTENDANCE — CLOCK IN / OUT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/attendance/clock-in
 * Records the clock-in. Requires a valid sessionToken.
 */
app.post("/api/attendance/clock-in", async (req, res) => {
  try {
    const { userId, sessionToken } = req.body;

    let payload;
    try {
      payload = jwt.verify(sessionToken, JWT_SECRET);
    } catch {
      return res.status(403).json({ message: "Invalid or expired session token" });
    }

    if (!payload.gpsVerified || !payload.biometricVerified) {
      return res.status(403).json({ message: "GPS and biometric verification required" });
    }

    const today = new Date().toISOString().split("T")[0];
    const clockInTime = new Date().toTimeString().slice(0, 5);

    // Check not already clocked in today
    const existing = await prisma.attendance.findFirst({
      where: { userId, date: today },
    });

    if (existing) {
      return res.status(409).json({
        message: "Already clocked in today",
        record: existing,
      });
    }

    const record = await prisma.attendance.create({
      data: {
        userId,
        date: today,
        clockIn: clockInTime,
        status: getAttendanceStatus(clockInTime),
        lat: payload.lat,
        lng: payload.lng,
        accuracy: payload.accuracy,
        gpsVerified: true,
        biometricVerified: true,
        officeId: payload.officeId,
      },
    });

    res.json(record);
  } catch (err) {
    console.error("Clock-in error:", err);
    res.status(500).json({ message: "Clock-in failed" });
  }
});

/**
 * POST /api/attendance/clock-out
 * Optional. Records clock-out time for the current day.
 */
app.post("/api/attendance/clock-out", async (req, res) => {
  try {
    const { userId } = req.body;
    const today = new Date().toISOString().split("T")[0];

    const record = await prisma.attendance.findFirst({
      where: { userId, date: today },
    });

    if (!record) {
      return res.status(404).json({ message: "No clock-in record found for today" });
    }

    if (record.clockOut) {
      return res.status(409).json({ message: "Already clocked out" });
    }

    const clockOutTime = new Date().toTimeString().slice(0, 5);

    const updated = await prisma.attendance.update({
      where: { id: record.id },
      data: { clockOut: clockOutTime },
    });

    res.json(updated);
  } catch (err) {
    console.error("Clock-out error:", err);
    res.status(500).json({ message: "Clock-out failed" });
  }
});

/**
 * GET /api/attendance/today/:userId
 * Returns today's record for a user.
 */
app.get("/api/attendance/today/:userId", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const record = await prisma.attendance.findFirst({
      where: { userId: req.params.userId, date: today },
    });
    res.json({ record: record || null });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch today's record" });
  }
});

/**
 * GET /api/auth/device-status/:userId
 * Checks if this user has a registered WebAuthn credential.
 */
app.get("/api/auth/device-status/:userId", async (req, res) => {
  try {
    const count = await prisma.webAuthnCredential.count({
      where: { userId: req.params.userId },
    });
    res.json({ registered: count > 0 });
  } catch (err) {
    res.status(500).json({ message: "Failed to check device status" });
  }
});

// ── Start server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`AttendIQ server running on port ${PORT}`);
  console.log(`RP_ID: ${RP_ID}`);
  console.log(`Origin: ${ORIGIN}`);
});