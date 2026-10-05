import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "ERP Haraka Seed", template: "%s · ERP Haraka Seed" },
  description: "Sistem ERP PT Benih Haraka Sejahtera",
  // Dipasang sebagai aplikasi di iPhone/iPad ("Tambahkan ke Layar Utama"); Android & komputer memakai app/manifest.ts.
  appleWebApp: { capable: true, title: "Haraka ERP", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#0a3b55" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
