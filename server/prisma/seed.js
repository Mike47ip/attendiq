// server/prisma/seed.js
// Run from server folder: node prisma/seed.js

import "dotenv/config";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import readline from "readline";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma  = new PrismaClient({ adapter });

function prompt(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, answer => { rl.close(); resolve(answer); });
  });
}

async function main() {
  console.log("\n🌱 AttendIQ Seed Script\n");

  // ── Step 1: Create PippingPole tenant ─────────────────────────────────
  console.log("Creating PippingPole tenant...");
  let tenant = await prisma.tenant.findUnique({ where: { slug: "pippingpole" } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: "PippingPole", slug: "pippingpole", isActive: true },
    });
    console.log("✅ Tenant created:", tenant.name);
  } else {
    console.log("✅ Tenant already exists:", tenant.name);
  }

  // ── Step 2: Create superadmin ──────────────────────────────────────────
  console.log("\nSetting up superadmin account...");
  const existing = await prisma.user.findUnique({ where: { email: "pippingpole@gmail.com" } });

  if (existing && existing.role === "superadmin") {
    console.log("✅ Superadmin already exists");
  } else {
    const password = await prompt("Enter superadmin password: ");
    if (!password || password.length < 6) {
      console.error("❌ Password must be at least 6 characters");
      process.exit(1);
    }
    const hashed = await bcrypt.hash(password, 10);

    if (existing) {
      await prisma.user.update({
        where: { email: "pippingpole@gmail.com" },
        data: { role: "superadmin", tenantId: null, password: hashed },
      });
      console.log("✅ Existing user upgraded to superadmin");
    } else {
      await prisma.user.create({
        data: {
          email:          "pippingpole@gmail.com",
          password:       hashed,
          name:           "Super Admin",
          role:           "superadmin",
          tenantId:       null,
          dept:           "Management",
          avatarInitials: "SA",
          color:          "#6366f1",
        },
      });
      console.log("✅ Superadmin created");
    }
  }

  // ── Step 3: Create default admin for PippingPole ───────────────────────
  console.log("\nSetting up PippingPole admin...");
  const adminExists = await prisma.user.findUnique({ where: { email: "admin@pippingpole.com" } });
  if (adminExists) {
    console.log("✅ Admin already exists");
  } else {
    const adminPassword = await prompt("Enter admin password for PippingPole: ");
    if (!adminPassword || adminPassword.length < 6) {
      console.error("❌ Password must be at least 6 characters");
      process.exit(1);
    }
    const hashed = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        tenantId:       tenant.id,
        email:          "admin@pippingpole.com",
        password:       hashed,
        name:           "PippingPole Admin",
        role:           "admin",
        dept:           "Management",
        avatarInitials: "PA",
        color:          "#6366f1",
      },
    });
    console.log("✅ PippingPole admin created");
  }

  console.log("\n🎉 Seed complete!\n");
  console.log("Login details:");
  console.log("  Superadmin:  pippingpole@gmail.com  (no company code)");
  console.log("  Admin:       admin@pippingpole.com  company code: pippingpole\n");
}

main()
  .catch(err => { console.error("Seed error:", err); process.exit(1); })
  .finally(() => prisma.$disconnect());