// server/prisma/seed.js

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma  = new PrismaClient({ adapter });

async function main() {
  // ── Office ───────────────────────────────────────────────────────────────
  // Replace with your real office coordinates
  const office = await prisma.office.upsert({
    where: { id: "seed-office" },
    update: {},
    create: {
      id:           "seed-office",
      name:         "Head Office",
      lat:          6.796750,    // ← replace with real lat
      lng:          -1.579770,   // ← replace with real lng
      radiusMetres: 150,
    },
  });
  console.log("✓ Office:", office.name);

  // ── Admin user ───────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@company.com" },
    update: {},
    create: {
      name:           "Admin",
      email:          "admin@company.com",
      password:       adminPassword,
      role:           "admin",
      dept:           "Management",
      avatarInitials: "AD",
      color:          "#6366f1",
      officeId:       office.id,
    },
  });
  console.log("✓ Admin created:", admin.email);

  console.log("");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Login credentials:");
  console.log("  Email:    admin@company.com");
  console.log("  Password: admin123");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Change this password after first login!");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());