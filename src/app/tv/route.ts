import { NextResponse, type NextRequest } from "next/server";

// Short address for the office TV: typing "pr-os1.vercel.app/tv" with a TV
// remote is far easier than the full monitor URL. Keeps any query string
// (e.g. /tv?classic=1).
export function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/monitor";
  return NextResponse.redirect(url, 307);
}
