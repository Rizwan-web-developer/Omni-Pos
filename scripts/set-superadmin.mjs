import { randomBytes, scryptSync } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// Resolve generated Prisma client (project uses .prisma/client mapping)
let PrismaClient;
try {
  ({ PrismaClient } = require("../node_modules/.prisma/client"));
} catch {
  ({ PrismaClient } = require("@prisma/client"));
}

const SCRYPT_KEYLEN = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }).toString("base64url");
  return `scrypt$${SCRYPT_N}$${salt}$${hash}`;
}

const email = "m.rizwanoffical9@gmail.com";
const password = "Rizwan788$#A"; // used only to generate hash; never logged
const name = "M. Rizwan";

const prisma = new PrismaClient();
try {
  const passwordHash = hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: "SUPER_ADMIN", isActive: true, tenantId: null },
    create: { name, email, passwordHash, role: "SUPER_ADMIN", isActive: true, tenantId: null },
    select: { id: true, email: true, role: true, name: true },
  });
  console.log("Super Admin configured:", user.email, user.role);
} finally {
  await prisma.$disconnect();
}
