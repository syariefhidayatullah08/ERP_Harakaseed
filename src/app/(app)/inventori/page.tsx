import { redirect } from "next/navigation";

/** Gudang & Lot dibagi menjadi Stok Varietas dan Buku Induk Benih; alamat lama diteruskan (pesan & saringan ikut). */
export default async function InventoryIndex({ searchParams }: PageProps<"/inventori">) {
  const sp = await searchParams;
  const q = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v === undefined ? [] : [[k, v]])));
  // Tautan lama ke buku induk (?jenis=…) diteruskan ke sub-menunya.
  redirect(`/inventori/${q.has("jenis") ? "buku-induk" : "varietas"}${q.size ? `?${q}` : ""}`);
}
