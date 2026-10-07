import { NextResponse, type NextRequest } from "next/server";

// Pemeriksaan cepat: tanpa cookie sesi → ke halaman login. Verifikasi penuh & hak akses ada di halaman/server action.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("haraka_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Manifest & ikon aplikasi harus bisa diambil tanpa login agar ERP bisa dipasang sebagai aplikasi.
  matcher: ["/((?!login|api/cron/|_next/static|_next/image|icon.png|apple-icon.png|manifest.webmanifest|icons/|logo|products/|i/|lembar-sw.js).*)"],
};
