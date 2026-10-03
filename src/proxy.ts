import { NextResponse, type NextRequest } from "next/server";

// Pemeriksaan cepat: tanpa cookie sesi → ke halaman login. Verifikasi penuh ada di layout (app).
export function proxy(request: NextRequest) {
  if (!request.cookies.has("haraka_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|logo.svg).*)"],
};
