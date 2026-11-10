/**
 * Seed: creates demo businesses across categories/panels if the DB is empty.
 * Run after db:push (see package.json / tsconfig excludes prisma/seed from app build).
 */
import {
  PrismaClient,
  IndustryType,
  PlanTier,
  UserRole,
  BusinessStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.tenant.count();
  if (count > 0) {
    console.log("Seed skipped: businesses already exist.");
    return;
  }

  const businesses = [
    {
      uid: "BUS-8821",
      businessName: "Aura Mobile Hub",
      slug: "aura-global-network",
      industryType: IndustryType.MOBILE_ACCESSORIES,
      subscriptionTier: PlanTier.ENTERPRISE,
      status: BusinessStatus.ACTIVE,
      ownerName: "Aisha Rahman",
      email: "ops@auramobile.io",
      phone: "+971 50 118 2200",
      location: "Dubai, UAE",
      mrr: 142300,
      terminals: 14,
      staff: 38,
      userEmail: "owner@auramobile.local",
    },
    {
      uid: "BUS-4402",
      businessName: "St. Jude Pharma Group",
      slug: "stjude-clinical-chain",
      industryType: IndustryType.PHARMACY,
      subscriptionTier: PlanTier.ENTERPRISE,
      status: BusinessStatus.ACTIVE,
      ownerName: "Dr. Sarah Lin",
      email: "it@stjudeclinical.com",
      phone: "+1 617 555 0142",
      location: "Boston, US",
      mrr: 89000,
      terminals: 28,
      staff: 64,
      userEmail: "owner@stjude.local",
    },
    {
      uid: "BUS-5188",
      businessName: "Volt Electronics",
      slug: "volt-electronics",
      industryType: IndustryType.ELECTRONICS,
      subscriptionTier: PlanTier.PRO,
      status: BusinessStatus.DEACTIVE,
      ownerName: "Daniel Okafor",
      email: "daniel@voltelectronics.ng",
      phone: "+234 1 555 0119",
      location: "Lagos, NG",
      mrr: 35000,
      terminals: 11,
      staff: 27,
      userEmail: "owner@volt.local",
    },
    {
      uid: "BUS-6624",
      businessName: "ColorCraft Paint Shop",
      slug: "colorcraft-paints",
      industryType: IndustryType.PAINT_SHOP,
      subscriptionTier: PlanTier.STARTER,
      status: BusinessStatus.ACTIVE,
      ownerName: "Priya Nair",
      email: "priya@colorcraft.co",
      phone: "+91 22 5550 1730",
      location: "Mumbai, IN",
      mrr: 24000,
      terminals: 8,
      staff: 18,
      userEmail: "owner@colorcraft.local",
    },
    {
      uid: "BUS-9031",
      businessName: "Glow Cosmetics Studio",
      slug: "glow-cosmetics",
      industryType: IndustryType.COSMETICS_SHOP,
      subscriptionTier: PlanTier.STARTER,
      status: BusinessStatus.TRIAL,
      ownerName: "Hira Khan",
      email: "hira@glowcosmetics.pk",
      phone: "+92 21 555 0121",
      location: "Karachi, PK",
      mrr: 18000,
      terminals: 4,
      staff: 9,
      userEmail: "owner@glow.local",
    },
    {
      uid: "BUS-2287",
      businessName: "BuildRight Hardware",
      slug: "buildright-hardware",
      industryType: IndustryType.HARDWARE_SHOP,
      subscriptionTier: PlanTier.PRO,
      status: BusinessStatus.DEACTIVE,
      ownerName: "Lena Fischer",
      email: "lena@buildright.de",
      phone: "+49 40 555 0177",
      location: "Hamburg, DE",
      mrr: 9500,
      terminals: 6,
      staff: 14,
      userEmail: "owner@buildright.local",
    },
  ] as const;

  for (const b of businesses) {
    const { userEmail, ...data } = b;
    await prisma.tenant.create({
      data: {
        ...data,
        isActive: data.status === BusinessStatus.ACTIVE || data.status === BusinessStatus.TRIAL,
        users: {
          create: {
            name: data.ownerName ?? "Owner",
            email: userEmail,
            passwordHash: "CHANGE_ME_HASH",
            role: UserRole.OWNER,
          },
        },
      },
    });
  }

  console.log(`Seeded ${businesses.length} businesses.`);
}

main().finally(() => prisma.$disconnect());
