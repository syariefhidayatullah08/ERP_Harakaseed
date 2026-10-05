"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { all, get, insert, run, tx } from "@/lib/db";
import { requireAccess } from "@/lib/session";
import { numf, str, withMsg } from "@/lib/form";
import { logActivity } from "@/lib/activity";
import { addDays, rupiah, today } from "@/lib/format";
import { INTAKE_KIND, INTAKE_STATUS, nextPbNumber, settle } from "@/lib/seed-payment";

const BASE = "/pembayaran-benih";
const date = (fd: FormData, key: string) => (/^\d{4}-\d{2}-\d{2}$/.test(str(fd, key)) ? str(fd, key) : null);
/** Angka opsional: kosong → null. */
const optNum = (fd: FormData, key: string) => (str(fd, key) === "" ? null : numf(fd, key));

/** Catat / ubah satu baris buku induk (benih masuk dari petani). */
export async function saveIntake(fd: FormData) {
  const user = await requireAccess("pembayaran_benih");
  const id = numf(fd, "id");
  const back = id ? `${BASE}/${id}` : `${BASE}/baru`;
  const old = id ? await get<{ status: string; pb_id: number | null; pb_status: string | null }>(
    "SELECT i.status, i.pb_id, pb.status pb_status FROM seed_intakes i LEFT JOIN seed_pb pb ON pb.id = i.pb_id WHERE i.id = ?", id) : undefined;
  if (id && !old) redirect(withMsg(BASE, "Data tidak ditemukan.", "error"));
  if (old?.pb_status === "dibayar" && user.role !== "owner") redirect(withMsg(back, "Baris ini sudah dibayar lewat surat PB; hanya Founder yang bisa mengubahnya.", "error"));

  const kind = str(fd, "kind") === "eksternal" ? "eksternal" : "internal";
  const farmer = str(fd, "farmer");
  if (!farmer) redirect(withMsg(back, "Nama petani wajib diisi.", "error"));
  const received = date(fd, "received_date");
  const due = date(fd, "due_date") ?? (received && numf(fd, "due_days") > 0 ? addDays(received, numf(fd, "due_days")) : null);
  const netKg = numf(fd, "net_kg");
  const price = numf(fd, "price");
  const loan = numf(fd, "loan");
  const deduction = numf(fd, "deduction");
  if (netKg < 0 || price < 0 || loan < 0 || deduction < 0) redirect(withMsg(back, "Bobot, harga, pinjaman, dan potongan tidak boleh minus.", "error"));
  const { amount, badDebt } = settle(netKg, price, loan, deduction);
  // Status mengikuti surat PB bila sudah diajukan; selain itu pilihan pengguna, dan otomatis kredit macet bila pinjaman tidak tertutup.
  const chosen = str(fd, "status");
  const status = badDebt > 0 ? "kredit_macet" : old?.pb_id && old.status !== "kredit_macet" ? old.status : chosen === "lunas" ? "lunas" : "proses_uji";

  const values = [
    kind, kind === "eksternal" ? str(fd, "company") : "", received, due, farmer, str(fd, "location"), str(fd, "officer").toUpperCase(), str(fd, "contract_no"),
    str(fd, "production_code").toUpperCase(), str(fd, "batch_no"), numf(fd, "gross_kg") || netKg, netKg,
    kind === "eksternal" ? optNum(fd, "shipped_kg") : null, kind === "eksternal" ? optNum(fd, "fix_kg") : null, kind === "eksternal" ? date(fd, "ship_date") : null,
    str(fd, "test_ka"), str(fd, "test_km"), str(fd, "test_db"), loan, price, kind === "eksternal" ? numf(fd, "contract_price") : 0,
    deduction, str(fd, "deduction_note"), amount, badDebt, status, str(fd, "notes"),
  ];
  const cols = `kind, company, received_date, due_date, farmer, location, officer, contract_no, production_code, batch_no, gross_kg, net_kg,
    shipped_kg, fix_kg, ship_date, test_ka, test_km, test_db, loan, price, contract_price, deduction, deduction_note, amount, bad_debt, status, notes`;
  if (id) await run(`UPDATE seed_intakes SET (${cols}) = (${values.map(() => "?").join(",")}) WHERE id = ?`, ...values, id);
  else {
    const newId = await insert(`INSERT INTO seed_intakes (${cols}) VALUES (${values.map(() => "?").join(",")})`, ...values);
    // Diteruskan dari Pengambilan Benih: tandai pengambilannya sudah masuk buku induk.
    if (numf(fd, "pickup_id")) {
      await run("UPDATE seed_pickups SET intake_id = ? WHERE id = ? AND intake_id IS NULL", newId, numf(fd, "pickup_id"));
      revalidatePath("/pengambilan");
    }
  }
  revalidatePath(BASE);
  await logActivity("pembayaran_benih", id ? "Mengubah data benih masuk" : "Mencatat benih masuk", `${farmer} · ${str(fd, "production_code").toUpperCase()} · ${netKg} kg · ${rupiah(amount)}`);
  redirect(withMsg(`${BASE}?kind=${kind}`, `Benih dari ${farmer} tersimpan: nilai pembayaran ${rupiah(amount)}${badDebt ? `, kredit macet ${rupiah(badDebt)}` : ""}.`));
}

/**
 * Hapus satu baris buku induk yang salah catat. Baris di surat PB yang belum dibayar ikut keluar dari suratnya
 * (surat yang jadi kosong ikut dihapus); baris di surat yang sudah dibayar hanya bisa dihapus Founder.
 */
export async function deleteIntake(fd: FormData) {
  const user = await requireAccess("pembayaran_benih");
  const id = numf(fd, "id");
  const row = await get<{ farmer: string; production_code: string; net_kg: number; amount: number; kind: string; pb_id: number | null; pb_no: string | null; pb_status: string | null }>(
    "SELECT i.farmer, i.production_code, i.net_kg, i.amount, i.kind, i.pb_id, pb.number pb_no, pb.status pb_status FROM seed_intakes i LEFT JOIN seed_pb pb ON pb.id = i.pb_id WHERE i.id = ?", id);
  if (!row) redirect(withMsg(BASE, "Data tidak ditemukan.", "error"));
  if (row.pb_status === "dibayar" && user.role !== "owner") redirect(withMsg(`${BASE}/${id}`, `Baris ini sudah dibayar lewat surat ${row.pb_no}; hanya Founder yang bisa menghapusnya.`, "error"));
  const pbGone = await tx(async () => {
    await run("DELETE FROM seed_intakes WHERE id = ?", id);
    if (!row.pb_id || (await get("SELECT 1 FROM seed_intakes WHERE pb_id = ? LIMIT 1", row.pb_id))) return false;
    await run("DELETE FROM seed_pb WHERE id = ?", row.pb_id);
    return true;
  });
  revalidatePath(BASE);
  await logActivity("pembayaran_benih", "Menghapus data benih masuk", `${row.farmer} · ${row.production_code} · ${row.net_kg} kg · ${rupiah(row.amount)}${row.pb_no ? ` · dari surat ${row.pb_no}` : ""}`);
  const note = !row.pb_no ? "" : pbGone ? ` Surat ${row.pb_no} ikut dihapus karena tidak ada baris lain.` : ` Baris ini juga dikeluarkan dari surat ${row.pb_no}.`;
  redirect(withMsg(`${BASE}?kind=${row.kind}`, `Data benih ${row.farmer} (${row.production_code || "tanpa kode"}) dihapus.${note}`));
}

/** Buat surat pengajuan pembayaran benih (PB) dari baris buku induk yang dipilih. */
export async function createPb(fd: FormData) {
  const user = await requireAccess("pembayaran_benih");
  const kind = str(fd, "kind") === "eksternal" ? "eksternal" : "internal";
  const back = `${BASE}/pb/baru?kind=${kind}`;
  const ids = [...new Set(fd.getAll("ids").map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) redirect(withMsg(back, "Centang minimal satu baris benih yang diajukan.", "error"));
  const pbDate = date(fd, "pb_date") ?? today();
  const number = str(fd, "number") || (await nextPbNumber(kind, pbDate));
  if (await get("SELECT 1 FROM seed_pb WHERE number = ?", number)) redirect(withMsg(back, `Nomor surat ${number} sudah dipakai.`, "error"));

  const idList = `{${ids.join(",")}}`;
  const pbId = await tx(async () => {
    const free = await all<{ id: number }>("SELECT id FROM seed_intakes WHERE id = ANY(?::int[]) AND kind = ? AND pb_id IS NULL AND status <> 'lunas' FOR UPDATE", idList, kind);
    if (free.length !== ids.length) return 0;
    const newId = await insert("INSERT INTO seed_pb (number, kind, pb_date, notes, created_by) VALUES (?,?,?,?,?)", number, kind, pbDate, str(fd, "notes"), user.id);
    await run("UPDATE seed_intakes SET pb_id = ?, status = CASE WHEN status = 'proses_uji' THEN 'diajukan' ELSE status END WHERE id = ANY(?::int[])", newId, idList);
    return newId;
  });
  if (!pbId) redirect(withMsg(back, "Sebagian baris sudah diajukan atau dibayar orang lain. Muat ulang lalu pilih lagi.", "error"));
  revalidatePath(BASE);
  await logActivity("pembayaran_benih", "Membuat surat pengajuan PB", `${number} · ${INTAKE_KIND[kind]} · ${ids.length} baris`);
  redirect(withMsg(`${BASE}/pb/${pbId}`, `Surat ${number} dibuat. Cetak, lalu minta tanda tangan.`));
}

/** Direktur/Founder menandai surat PB sudah dibayar → semua barisnya menjadi Lunas. */
export async function payPb(fd: FormData) {
  const user = await requireAccess("pembayaran_benih");
  const id = numf(fd, "id");
  const pb = await get<{ number: string; status: string }>("SELECT number, status FROM seed_pb WHERE id = ?", id);
  if (!pb) redirect(withMsg(`${BASE}?tab=pb`, "Surat PB tidak ditemukan.", "error"));
  if (user.role !== "owner") redirect(withMsg(`${BASE}/pb/${id}`, "Hanya Founder yang bisa menandai surat PB sudah dibayar.", "error"));
  if (pb.status === "dibayar") redirect(withMsg(`${BASE}/pb/${id}`, "Surat ini sudah ditandai dibayar."));
  const paidAt = date(fd, "paid_at") ?? today();
  await tx(async () => {
    await run("UPDATE seed_pb SET status = 'dibayar', paid_at = ? WHERE id = ?", paidAt, id);
    await run("UPDATE seed_intakes SET status = 'lunas' WHERE pb_id = ? AND status = 'diajukan'", id);
  });
  revalidatePath(BASE);
  const total = (await get<{ t: number }>("SELECT COALESCE(SUM(amount), 0) t FROM seed_intakes WHERE pb_id = ?", id))!.t;
  await logActivity("pembayaran_benih", "Menandai surat PB dibayar", `${pb.number} · ${rupiah(total)}`);
  redirect(withMsg(`${BASE}/pb/${id}`, `Surat ${pb.number} ditandai dibayar; barisnya menjadi ${INTAKE_STATUS.lunas.label}.`));
}

/** Hapus surat PB: barisnya kembali ke buku induk sebagai belum diajukan. Surat yang sudah dibayar hanya bisa dihapus Founder. */
export async function deletePb(fd: FormData) {
  const user = await requireAccess("pembayaran_benih");
  const id = numf(fd, "id");
  const pb = await get<{ number: string; status: string }>("SELECT number, status FROM seed_pb WHERE id = ?", id);
  if (!pb) redirect(withMsg(`${BASE}?tab=pb`, "Surat PB tidak ditemukan.", "error"));
  if (pb.status === "dibayar" && user.role !== "owner") redirect(withMsg(`${BASE}/pb/${id}`, "Surat yang sudah dibayar hanya bisa dihapus Founder.", "error"));
  await tx(async () => {
    await run("UPDATE seed_intakes SET pb_id = NULL, status = CASE WHEN status IN ('diajukan','lunas') THEN 'proses_uji' ELSE status END WHERE pb_id = ?", id);
    await run("DELETE FROM seed_pb WHERE id = ?", id);
  });
  revalidatePath(BASE);
  await logActivity("pembayaran_benih", "Menghapus surat pengajuan PB", pb.number);
  redirect(withMsg(`${BASE}?tab=pb`, `Surat ${pb.number} dihapus; barisnya kembali belum diajukan.`));
}
