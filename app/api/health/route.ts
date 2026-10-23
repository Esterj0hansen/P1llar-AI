import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    service: "p1llar-ai",
    status: "ok",
    stage: "foundation",
    note: "The marketing site is available. Authentication, AI responses, and business knowledge storage are not connected yet.",
  });
}
