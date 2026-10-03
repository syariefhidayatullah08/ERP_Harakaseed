import { currentUser } from "@/lib/session";
import { canAccess } from "@/lib/access";
import { today } from "@/lib/format";
import { salesByCustomer, salesByProduct, salesLines, stockByLot, toCsv } from "@/lib/reports";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!canAccess(user.role, "laporan")) return new Response("Forbidden", { status: 403 });
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "penjualan";
  const from = url.searchParams.get("from") ?? `${today().slice(0, 4)}-01-01`;
  const to = url.searchParams.get("to") ?? today();

  const data: Record<string, () => Promise<Record<string, unknown>[]>> = {
    penjualan: () => salesLines(from, to),
    produk: () => salesByProduct(from, to),
    pelanggan: () => salesByCustomer(from, to),
    stok: () => stockByLot(),
  };
  const build = data[type];
  if (!build) return new Response("Jenis laporan tidak dikenal", { status: 400 });

  // BOM agar Excel membaca UTF-8 dengan benar
  const csv = "﻿" + toCsv(await build());
  const name = type === "stok" ? `stok-${today()}.csv` : `${type}-${from}_${to}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
