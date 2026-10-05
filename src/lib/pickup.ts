// Pengambilan benih di lahan petani oleh petugas produksi: berapa kg yang diambil + foto buktinya.
// Setelah benih sampai dan dicek, admin meneruskannya ke buku induk Pembayaran Benih.

export type Pickup = {
  id: number;
  pickup_date: string;
  farmer: string;
  location: string;
  production_code: string;
  contract_no: string;
  kg: number;
  sacks: number;
  notes: string;
  officer_id: number | null;
  officer_name: string;
  intake_id: number | null;
  created_at: string;
};

export const PICKUP_STATUS = {
  lapangan: { label: "Belum masuk buku induk", tone: "amber" },
  masuk: { label: "Sudah di buku induk", tone: "green" },
} as const;

export const pickupStatus = (p: { intake_id: number | null }) => PICKUP_STATUS[p.intake_id ? "masuk" : "lapangan"];
