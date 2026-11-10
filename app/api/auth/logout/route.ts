import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth/server";

export async function POST() {
  const res = NextResponse.json({ message: "Logged out" }, { status: 200 });
  res.cookies.set({
    name: AUTH_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
  return res;
}
