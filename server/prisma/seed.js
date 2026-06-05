// server/prisma/seed.js

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // ── Create your office ──────────────────────────────────────────────
  // Replace lat and lng with your real office coordinates from Google Maps
  const office = await prisma.office.create({
    data: {
      name: "Head Office",
      lat: 5.6037,       // ← your real office lat
      lng: -0.1870,      // ← your real office lng
      radiusMetres: 150,
    },
  });

  console.log("✓ Office created:", office.name, office.id);

  // ── Create a test user ──────────────────────────────────────────────
  const user = await prisma.user.create({
    data: {
      name: "Amara Osei",
      email: "amara@company.com",
      role: "staff",
      dept: "Tech",
      avatarInitials: "AO",
      color: "#6366f1",
      officeId: office.id,
    },
  });

  console.log("✓ User created:", user.name, user.id);
  console.log("");
  console.log("── Copy this into App.jsx ──────────────────────");
  console.log(`id: "${user.id}"`);
  console.log(`officeId: "${office.id}"`);
  console.log("────────────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());