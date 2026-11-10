import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  createSessionCookie,
  hashPassword,
  normalizeEmail,
  sessionCookieOptions,
  validatePassword,
  type SessionRole,
} from "@/lib/auth/server";

export async function POST() {
  return NextResponse.json({ message: "Signup is disabled. Use the admin login page." }, { status: 403 });
}
