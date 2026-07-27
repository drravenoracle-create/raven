import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/app/lib/google-admin-auth";

export function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  return response;
}