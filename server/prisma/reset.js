// server/prisma/reset.js
import "dotenv/config";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Delete PippingPole tenant (cascades to its users/offices/attendance)
  await prisma.tenant.deleteMany({ where: { slug: "pippingpole" } });
  console.log("✅ Deleted PippingPole tenant + cascaded data");

  // Delete superadmin separately (tenantId is null, no cascade applies)
  await prisma.user.deleteMany({ where: { email: "pippingpole@gmail.com" } });
  console.log("✅ Deleted superadmin");

  console.log("\n🧹 Reset complete. Run seed.js again.\n");
}

main()
  .catch(err => { console.error("Reset error:", err); process.exit(1); })
  .finally(() => prisma.$disconnect());