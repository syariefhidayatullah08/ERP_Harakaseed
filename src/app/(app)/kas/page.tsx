import Link from "next/link";
import type { Metadata } from "next";
import { all, get } from "@/lib/db";
import { rupiah, tanggal, today } from "@/lib/format";
import { Badge, Card, Empty, Field, Flash, PageHeader, StatCard } from "@/components/ui";
import { SubmitButton } from "@/components/buttons";
import { deleteCashEntry, saveCashEntry, setCashEntryAccount, transferCash } from "@/actions/cash";
import { requireAccess } from "@/lib/session";
import { ExportMenu } from "@/components/export-menu";
import { CASH_ACCOUNTS, CASH_CATEGORIES, cashCategoryLabel, type CashEntry } from "@/lib/cash";

export const metadata: Metadata = { title: "Buku Kas" };

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const monthLabel = (m: string) => `${BULAN[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

export default async function CashBookPage({ searchParams }: PageProps<"/kas">) {
  await requireAccess("kas");
  const sp = await searchParams;
  const months = (await all<{ m: string }>("SELECT DISTINCT substr(entry_date, 1, 7) m FROM cash_entries ORDER BY 1 DESC")).map((r) => r.m);
  const month = typeof sp.bulan === "string" && /^\d{4}-\d{2}$/.test(sp.bulan) ? sp.bulan : (months[0] ?? today().slice(0, 7));
  const from = `${month}-01`;
  const to = `${month}-31`;
  // Akun yang ditampilkan: semua, rekening bank, atau kas tunai. Saldo berjalan mengikuti pilihan ini.
  const akun = sp.akun === "bank" || sp.akun === "tunai" ? sp.akun : "";
  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ bulan: month, akun, ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return `/kas?${p}`;
  };

  // Saldo tiap akun di akhir bulan yang dipilih.
  const saldo = await all<{ account: string; v: number }>("SELECT account, COALESCE(SUM(amount_in - amount_out), 0) v FROM cash_entries WHERE entry_date <= ? GROUP BY account", to);
  const saldoOf = (a: string) => saldo.find((s) => s.account === a)?.v ?? 0;

  const opening = (await get<{ v: number }>("SELECT COALESCE(SUM(amount_in - amount_out), 0) v FROM cash_entries WHERE entry_date < ? AND (? = '' OR account = ?)", from, akun, akun))!.v;
  const entries = await all<CashEntry>(
    "SELECT k.id, k.entry_date, k.description, k.category, k.amount_in, k.amount_out, k.account, k.transfer_ref, k.pb_id, k.po_id, p.so_id FROM cash_entries k LEFT JOIN payments p ON p.id = k.payment_id WHERE k.entry_date >= ? AND k.entry_date <= ? AND (? = '' OR k.account = ?) ORDER BY k.entry_date, k.id",
    from, to, akun, akun,
  );
  // Pindah saldo antar akun bukan pemasukan/pengeluaran perusahaan bila dilihat gabungan.
  const counted = akun ? entries : entries.filter((e) => e.category !== "pindah");
  const totalIn = counted.reduce((s, e) => s + e.amount_in, 0);
  const totalOut = counted.reduce((s, e) => s + e.amount_out, 0);
  // Saldo berjalan: saldo baris sebelumnya + masuk − keluar.
  const rows = entries.reduce<(CashEntry & { balance: number })[]>((acc, e) => [...acc, { ...e, balance: (acc.at(-1)?.balance ?? opening) + e.amount_in - e.amount_out }], []);

  const byCategory = Object.keys(CASH_CATEGORIES)
    .map((key) => ({
      key,
      masuk: entries.filter((e) => e.category === key).reduce((s, e) => s + e.amount_in, 0),
      keluar: entries.filter((e) => e.category === key).reduce((s, e) => s + e.amount_out, 0),
      n: entries.filter((e) => e.category === key).length,
    }))
    .filter((c) => c.n > 0);

  return (
    <>
      <PageHeader
        title="Buku Kas"
        subtitle={`Pemasukan dan pengeluaran harian perusahaan per akun (bank & kas tunai) · ${monthLabel(month)}. Hanya bisa dilihat Founder.`}
        actions={<ExportMenu type="kas" from={from} to={to} />}
      />
      <Flash msg={sp.msg as string} error={sp.error as string} />

      {months.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {(months.includes(month) ? months : [month, ...months]).map((m) => (
            <Link key={m} href={href({ bulan: m })} className={m === month ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>
              {monthLabel(m)}
            </Link>
          ))}
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={`Saldo bank · akhir ${monthLabel(month)}`} value={rupiah(saldoOf("bank"))} tone={saldoOf("bank") < 0 ? "danger" : "default"} href={href({ akun: "bank" })} hint="Klik untuk lihat mutasi bank" />
        <StatCard label={`Saldo kas tunai · akhir ${monthLabel(month)}`} value={rupiah(saldoOf("tunai"))} tone={saldoOf("tunai") < 0 ? "danger" : "default"} href={href({ akun: "tunai" })} hint="Klik untuk lihat mutasi kas tunai" />
        <StatCard label="Total saldo (bank + tunai)" value={rupiah(saldoOf("bank") + saldoOf("tunai"))} href={href({ akun: "" })} hint="Klik untuk lihat semua" />
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {[["", "Semua akun"], ["bank", "Bank"], ["tunai", "Kas tunai"]].map(([k, label]) => (
          <Link key={k} href={href({ akun: k })} className={`rounded-full px-3 py-1 text-xs font-semibold ${akun === k ? "bg-brand-700 text-white" : "bg-canvas text-muted hover:text-ink"}`}>
            {label}
          </Link>
        ))}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={`Saldo awal bulan${akun ? ` · ${CASH_ACCOUNTS[akun]}` : ""}`} value={rupiah(opening)} />
        <StatCard label="Pemasukan" value={rupiah(totalIn)} hint={`${entries.filter((e) => e.amount_in > 0).length} transaksi`} />
        <StatCard label="Pengeluaran" value={rupiah(totalOut)} hint={`${entries.filter((e) => e.amount_out > 0).length} transaksi`} />
        <StatCard label="Saldo akhir" value={rupiah(opening + totalIn - totalOut)} tone={opening + totalIn - totalOut < 0 ? "danger" : "default"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title={`Transaksi ${monthLabel(month)}${akun ? ` · ${CASH_ACCOUNTS[akun]}` : ""} (${entries.length})`} className="overflow-hidden lg:col-span-2">
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th className="min-w-56">Keterangan</th>
                    <th>Akun</th>
                    <th className="num">Pemasukan</th>
                    <th className="num">Pengeluaran</th>
                    <th className="num">Saldo</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap text-muted">{tanggal(e.entry_date)}</td>
                      <td>
                        <div className="font-medium">{e.description}</div>
                        <div className="text-xs text-muted">
                          {cashCategoryLabel(e.category)}
                          {(e.so_id || e.pb_id || e.po_id) && (
                            <>
                              {" · "}
                              <Link href={e.so_id ? `/penjualan/${e.so_id}` : e.pb_id ? `/pembayaran-benih/pb/${e.pb_id}` : `/pembelian/${e.po_id}`} className="text-brand-700 hover:underline">
                                otomatis dari {e.so_id ? "pesanan" : e.pb_id ? "surat PB" : "PO pembelian"}
                              </Link>
                            </>
                          )}
                        </div>
                      </td>
                      <td>
                        <Badge tone={e.account === "tunai" ? "amber" : "blue"}>{CASH_ACCOUNTS[e.account] ?? e.account}</Badge>
                        {!e.transfer_ref && (
                          <form action={setCashEntryAccount} className="mt-1">
                            <input type="hidden" name="id" value={e.id} />
                            <input type="hidden" name="account" value={e.account === "tunai" ? "bank" : "tunai"} />
                            <button className="text-[11px] text-brand-700 hover:underline">→ {e.account === "tunai" ? "Bank" : "Kas tunai"}</button>
                          </form>
                        )}
                      </td>
                      <td className="num text-emerald-700">{e.amount_in ? rupiah(e.amount_in) : ""}</td>
                      <td className="num text-red-700">{e.amount_out ? rupiah(e.amount_out) : ""}</td>
                      <td className="num font-medium">{rupiah(e.balance)}</td>
                      <td>
                        {!e.so_id && !e.pb_id && !e.po_id && (
                          <form action={deleteCashEntry}>
                            <input type="hidden" name="id" value={e.id} />
                            <SubmitButton className="btn-danger btn-sm" confirm={e.transfer_ref ? `Hapus pindah saldo "${e.description}"? Kedua barisnya (bank & tunai) ikut terhapus.` : `Hapus transaksi "${e.description}"?`}>
                              Hapus
                            </SubmitButton>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Belum ada transaksi pada bulan ini.</Empty>
          )}
        </Card>

        <div className="space-y-5">
          <Card title="Catat transaksi">
            <form action={saveCashEntry} className="space-y-3 p-5">
              <Field label="Tanggal *">
                <input name="entry_date" type="date" required defaultValue={today().startsWith(month) ? today() : from} className="input" />
              </Field>
              <Field label="Keterangan *">
                <input name="description" required className="input" placeholder="mis. Pembayaran benih bulky Botani Seed" />
              </Field>
              <Field label="Akun *">
                <select name="account" defaultValue={akun || "bank"} className="input">
                  <option value="bank">Bank</option>
                  <option value="tunai">Kas tunai</option>
                </select>
              </Field>
              <Field label="Kategori *">
                <select name="category" required defaultValue="" className="input">
                  <option value="" disabled>
                    Pilih kategori…
                  </option>
                  {Object.entries(CASH_CATEGORIES)
                    .filter(([k]) => k !== "pindah")
                    .map(([k, c]) => (
                    <option key={k} value={k}>
                      {c.code ? `${c.code} · ` : ""}
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <input type="radio" name="direction" value="masuk" required className="accent-brand-700" /> Pemasukan
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="radio" name="direction" value="keluar" required className="accent-brand-700" /> Pengeluaran
                </label>
              </div>
              <Field label="Jumlah (Rp) *">
                <input name="amount" type="number" min={1} step="any" required className="input" />
              </Field>
              <SubmitButton className="btn-primary w-full">Simpan transaksi</SubmitButton>
              <p className="text-xs text-muted">
                Pembayaran pesanan penjualan (tunai → kas tunai, transfer/giro/QRIS → bank), surat PB, dan PO pembelian yang ditandai dibayar otomatis masuk ke sini, jadi tidak perlu diketik ulang. Saldo awal tiap akun dicatat dengan kategori &ldquo;Saldo awal&rdquo;.
              </p>
            </form>
          </Card>

          <Card title="Pindah saldo (tarik / setor tunai)">
            <form action={transferCash} className="space-y-3 p-5">
              <Field label="Tanggal *">
                <input name="entry_date" type="date" required defaultValue={today().startsWith(month) ? today() : from} className="input" />
              </Field>
              <Field label="Arah *">
                <select name="from" defaultValue="bank" className="input">
                  <option value="bank">Tarik tunai: Bank → Kas tunai</option>
                  <option value="tunai">Setor tunai: Kas tunai → Bank</option>
                </select>
              </Field>
              <Field label="Jumlah (Rp) *">
                <input name="amount" type="number" min={1} step="any" required className="input" />
              </Field>
              <Field label="Catatan">
                <input name="note" className="input" placeholder="mis. untuk gaji harian gudang" />
              </Field>
              <SubmitButton className="btn-secondary w-full">Pindahkan saldo</SubmitButton>
              <p className="text-xs text-muted">Saldo satu akun berkurang dan akun lain bertambah; total saldo perusahaan tetap.</p>
            </form>
          </Card>

          <Card title="Rekap per kategori" className="overflow-hidden">
            {byCategory.length ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Kategori</th>
                    <th className="num">Masuk</th>
                    <th className="num">Keluar</th>
                  </tr>
                </thead>
                <tbody>
                  {byCategory.map((c) => (
                    <tr key={c.key}>
                      <td className="text-xs">{cashCategoryLabel(c.key)}</td>
                      <td className="num text-xs text-emerald-700">{c.masuk ? rupiah(c.masuk) : ""}</td>
                      <td className="num text-xs text-red-700">{c.keluar ? rupiah(c.keluar) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty>Belum ada transaksi.</Empty>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
