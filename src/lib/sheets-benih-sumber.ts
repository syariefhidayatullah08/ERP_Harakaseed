// DIBUAT OTOMATIS oleh scripts/gen-benih-sumber.mjs dari:
//   referensi/BUKU INDUK MAMPU TELUSUR BENIH SUMBER 2026.xlsx
//   referensi/KETERSEDIAAN BENIH SUMBER DI GUDANG terbaru 2026.xlsx
// Jangan diubah manual; jalankan ulang generatornya bila susunan kolom Excel berubah.
import type { SheetDef } from "./sheets";

export const BENIH_SUMBER_SHEETS: SheetDef[] = [
  {
    "key": "ss-masuk-internal",
    "title": "SS Masuk BENIH INTERNAL",
    "excelName": "SS Masuk BENIH INTERNAL ",
    "workbook": "bukuInduk",
    "module": "produksi",
    "headerRows": [
      5,
      6
    ],
    "dataStart": 7,
    "notes": [
      {
        "cell": "C2",
        "text": "BUKU INDUK MAMPU TELUSUR SS MASUK INTERNAL"
      },
      {
        "cell": "C3",
        "text": "PT. BENIH HARAKA SEJAHTERA (PERIODE 2025)"
      }
    ],
    "columns": [
      {
        "key": "A",
        "label": "NO.",
        "width": 57
      },
      {
        "key": "B",
        "label": "NO. KONTRAK",
        "width": 98
      },
      {
        "key": "C",
        "label": "VARIETAS",
        "width": 171
      },
      {
        "key": "D",
        "label": "KODE PRODUKSI",
        "width": 147
      },
      {
        "key": "E",
        "label": "M/F/OP",
        "width": 113
      },
      {
        "key": "F",
        "label": "PETANI",
        "width": 214
      },
      {
        "key": "G",
        "label": "PETUGAS",
        "width": 97
      },
      {
        "key": "H",
        "label": "TANGGAL BENIH MASUK",
        "width": 92,
        "type": "date"
      },
      {
        "key": "I",
        "label": "BOBOT (gr)",
        "width": 65
      },
      {
        "key": "J",
        "label": "BOBOT SETELAH PROSES + PCB (gr)",
        "width": 153
      },
      {
        "key": "K",
        "label": "NO LOT",
        "width": 127
      },
      {
        "key": "L",
        "label": "TGL MASUK LAB",
        "width": 128,
        "type": "date"
      },
      {
        "key": "M",
        "label": "KETERANGAN",
        "width": 226
      }
    ]
  },
  {
    "key": "ss-keluar-internal",
    "title": "SS KELUAR BENIH INTERNAL",
    "excelName": "SS KELUAR BENIH INTERNAL",
    "workbook": "bukuInduk",
    "module": "produksi",
    "headerRows": [
      6
    ],
    "dataStart": 7,
    "notes": [
      {
        "cell": "D2",
        "text": "REKAPITULASI BENIH SUMBER KELUAR"
      },
      {
        "cell": "D3",
        "text": "PT. BENIH HARAKA SEJAHTERA (PERIODE 2026)"
      },
      {
        "cell": "R3",
        "text": "Eksternal"
      },
      {
        "cell": "R4",
        "text": "ISO"
      },
      {
        "cell": "R5",
        "text": "Bukan kontrak baru"
      }
    ],
    "columns": [
      {
        "key": "A",
        "label": "Tanggal Pengajuan Benih Sumber",
        "width": 106,
        "type": "date"
      },
      {
        "key": "B",
        "label": "Tanggal penyiapan benih sumber",
        "width": 137,
        "type": "date"
      },
      {
        "key": "C",
        "label": "Petugas",
        "width": 86
      },
      {
        "key": "D",
        "label": "Petani",
        "width": 167
      },
      {
        "key": "E",
        "label": "Alamat",
        "width": 260
      },
      {
        "key": "F",
        "label": "No Kontrak",
        "width": 105
      },
      {
        "key": "G",
        "label": "Blok",
        "width": 69
      },
      {
        "key": "H",
        "label": "Status",
        "width": 164
      },
      {
        "key": "I",
        "label": "Kode Produksi",
        "width": 145
      },
      {
        "key": "J",
        "label": "Varietas",
        "width": 98
      },
      {
        "key": "K",
        "label": "Luas lahan (ha)",
        "width": 92
      },
      {
        "key": "L",
        "label": "Pop",
        "width": 95
      },
      {
        "key": "M",
        "label": "Target (kg)",
        "width": 56
      },
      {
        "key": "N",
        "label": "Bobot 1000 btr",
        "width": 63
      },
      {
        "key": "O",
        "label": "Male (gr)",
        "width": 56,
        "formula": "=P{r}/4"
      },
      {
        "key": "P",
        "label": "Female (gr)",
        "width": 92,
        "formula": "=L{r}/1000*N{r}*120%"
      },
      {
        "key": "Q",
        "label": "LOT MALE",
        "width": 159
      },
      {
        "key": "R",
        "label": "LOT FEMALE",
        "width": 237
      },
      {
        "key": "S",
        "label": "MALE",
        "width": 100
      },
      {
        "key": "T",
        "label": "FEMALE",
        "width": 100
      },
      {
        "key": "U",
        "label": "Ket",
        "width": 260
      }
    ]
  },
  {
    "key": "ss-masuk-nh",
    "title": "SS MASUK NH",
    "excelName": "SS MASUK NH",
    "workbook": "bukuInduk",
    "module": "produksi",
    "headerRows": [
      5,
      6
    ],
    "dataStart": 7,
    "notes": [
      {
        "cell": "C2",
        "text": "BUKU INDUK MAMPU TELUSUR SS MASUK INTERNAL"
      },
      {
        "cell": "C3",
        "text": "PT. BENIH HARAKA SEJAHTERA (PERIODE 2026)"
      }
    ],
    "columns": [
      {
        "key": "A",
        "label": "NO.",
        "width": 57
      },
      {
        "key": "B",
        "label": "NO SURAT NH",
        "width": 192
      },
      {
        "key": "C",
        "label": "VARIETAS",
        "width": 119
      },
      {
        "key": "D",
        "label": "KODE PRODUKSI",
        "width": 110
      },
      {
        "key": "E",
        "label": "M/F/OP",
        "width": 121
      },
      {
        "key": "F",
        "label": "PETANI",
        "width": 93
      },
      {
        "key": "G",
        "label": "TANGGAL SURAT PENGAJUAN",
        "width": 127,
        "type": "date"
      },
      {
        "key": "H",
        "label": "TANGGAL BENIH MASUK",
        "width": 92,
        "type": "date"
      },
      {
        "key": "I",
        "label": "BOBOT (gr)",
        "width": 88
      },
      {
        "key": "J",
        "label": "BOBOT SETELAH PROSES + PCB (gr)",
        "width": 153
      },
      {
        "key": "K",
        "label": "NO LOT",
        "width": 127
      },
      {
        "key": "L",
        "label": "POPULASI",
        "width": 127
      },
      {
        "key": "M",
        "label": "TGL MASUK LAB",
        "width": 128
      },
      {
        "key": "N",
        "label": "KETERANGAN",
        "width": 229
      }
    ]
  },
  {
    "key": "ss-keluar-nh",
    "title": "SS Keluar NH",
    "excelName": "SS Keluar NH",
    "workbook": "bukuInduk",
    "module": "produksi",
    "headerRows": [
      7
    ],
    "dataStart": 8,
    "notes": [
      {
        "cell": "D2",
        "text": "REKAPITULASI BENIH SUMBER KELUAR"
      },
      {
        "cell": "D3",
        "text": "PT. BENIH HARAKA SEJAHTERA (PERIODE 2026)"
      },
      {
        "cell": "T3",
        "text": "Bukan kontrak baru"
      },
      {
        "cell": "T4",
        "text": "BUFFER"
      },
      {
        "cell": "T5",
        "text": "Terminal"
      },
      {
        "cell": "T6",
        "text": "Kontrak yang tidak urut"
      }
    ],
    "columns": [
      {
        "key": "A",
        "label": "Tanggal Pengajuan Benih Sumber",
        "width": 127,
        "type": "date"
      },
      {
        "key": "B",
        "label": "Penyiapan benih sumber",
        "width": 106,
        "type": "date"
      },
      {
        "key": "C",
        "label": "Petugas",
        "width": 70
      },
      {
        "key": "D",
        "label": "Petani",
        "width": 134
      },
      {
        "key": "E",
        "label": "Alamat",
        "width": 260
      },
      {
        "key": "F",
        "label": "No Kontrak",
        "width": 105
      },
      {
        "key": "G",
        "label": "Status",
        "width": 123
      },
      {
        "key": "H",
        "label": "Kode Produksi",
        "width": 76
      },
      {
        "key": "I",
        "label": "Varietas",
        "width": 82
      },
      {
        "key": "J",
        "label": "Luas lahan (ha)",
        "width": 65
      },
      {
        "key": "K",
        "label": "Pop",
        "width": 95
      },
      {
        "key": "L",
        "label": "Target (kg)",
        "width": 56
      },
      {
        "key": "M",
        "label": "Bobot 1000 btr",
        "width": 63
      },
      {
        "key": "N",
        "label": "Male (gr)",
        "width": 60,
        "formula": "=O{r}/4"
      },
      {
        "key": "O",
        "label": "Female (gr)",
        "width": 66,
        "formula": "=K{r}/1000*M{r}*120%"
      },
      {
        "key": "P",
        "label": "LOT MALE",
        "width": 169
      },
      {
        "key": "Q",
        "label": "LOT FEMALE",
        "width": 196
      },
      {
        "key": "R",
        "label": "STOCK MALE (gr)",
        "width": 196
      },
      {
        "key": "S",
        "label": "STOCK FEMALE (gr)",
        "width": 196
      },
      {
        "key": "T",
        "label": "Ket",
        "width": 260
      },
      {
        "key": "U",
        "label": "U",
        "width": 75
      }
    ]
  },
  {
    "key": "ss-mtm",
    "title": "SS MTM",
    "excelName": "SS MTM ",
    "workbook": "bukuInduk",
    "module": "produksi",
    "headerRows": [
      3,
      4
    ],
    "dataStart": 5,
    "notes": [
      {
        "cell": "A1",
        "text": "BENIH SS MASUK DAN KELUR MTM",
        "bg": "#FFC000"
      },
      {
        "cell": "K2",
        "text": "17/11/2025"
      }
    ],
    "columns": [
      {
        "key": "A",
        "label": "NO",
        "width": 75
      },
      {
        "key": "B",
        "label": "VARIETAS",
        "width": 162
      },
      {
        "key": "C",
        "label": "Petugas",
        "width": 237
      },
      {
        "key": "D",
        "label": "TANGGAL MASUK/KELUAR",
        "width": 202,
        "type": "date"
      },
      {
        "key": "E",
        "label": "LOT",
        "width": 128
      },
      {
        "key": "F",
        "group": "SS KELUAR/MASUK (Kg)",
        "label": "SS MASUK",
        "width": 96
      },
      {
        "key": "G",
        "group": "SS KELUAR/MASUK (Kg)",
        "label": "SS KELUAR",
        "width": 119
      },
      {
        "key": "H",
        "label": "STOCK SS",
        "width": 107
      },
      {
        "key": "I",
        "label": "KETERANGAN",
        "width": 260
      },
      {
        "key": "J",
        "label": "J",
        "width": 94
      },
      {
        "key": "K",
        "label": "PETUGAS",
        "width": 100
      },
      {
        "key": "L",
        "label": "KODE PRODUKSI",
        "width": 105
      },
      {
        "key": "M",
        "label": "TOTAL BENIH YANG DIBAWA",
        "width": 102
      },
      {
        "key": "N",
        "label": "TOTAL YANG TERLAPOR",
        "width": 183
      },
      {
        "key": "O",
        "label": "BELUM MASUK LAPORAN",
        "width": 128
      },
      {
        "key": "P",
        "label": "KET",
        "width": 193
      }
    ]
  },
  {
    "key": "benih-masuk-mtm",
    "title": "BENIH MASUK MTM",
    "excelName": "BENIH MASUK MTM ",
    "workbook": "bukuInduk",
    "module": "produksi",
    "headerRows": [
      3
    ],
    "dataStart": 4,
    "notes": [
      {
        "cell": "A1",
        "text": "BENIH MASUK YLB 2026",
        "bg": "#FFC000"
      }
    ],
    "columns": [
      {
        "key": "A",
        "label": "NO",
        "width": 65
      },
      {
        "key": "B",
        "label": "Tanggal masuk",
        "width": 117,
        "type": "date"
      },
      {
        "key": "C",
        "label": "Nama petugas",
        "width": 113
      },
      {
        "key": "D",
        "label": "Kode Produksi",
        "width": 113
      },
      {
        "key": "E",
        "label": "Nama Petani",
        "width": 177
      },
      {
        "key": "F",
        "label": "No. Kontrak",
        "width": 98
      },
      {
        "key": "G",
        "label": "No Lot",
        "width": 98
      },
      {
        "key": "H",
        "label": "Bobot Kotor",
        "width": 108
      },
      {
        "key": "I",
        "label": "Bobot Bersih",
        "width": 93,
        "formula": "=H{r}"
      },
      {
        "key": "J",
        "label": "Pengiriman",
        "width": 122,
        "type": "date"
      },
      {
        "key": "K",
        "label": "Keterangan",
        "width": 260
      }
    ]
  },
  {
    "key": "ketersediaan-ss",
    "title": "Ketersediaan SS",
    "excelName": "Ketersediaan SS",
    "workbook": "ketersediaan",
    "module": "stok_bahan",
    "headerRows": [
      4,
      5
    ],
    "dataStart": 6,
    "notes": [
      {
        "cell": "A1",
        "text": "KETERSEDIAAN STOCK SEED TARGET PRODUKSI TH. 2026"
      },
      {
        "cell": "F1",
        "text": "luas"
      },
      {
        "cell": "G1",
        "text": "target"
      },
      {
        "cell": "I1",
        "text": "populasi"
      },
      {
        "cell": "J1",
        "text": "target"
      },
      {
        "cell": "K1",
        "text": "1000"
      },
      {
        "cell": "M1",
        "text": "target"
      },
      {
        "cell": "N1",
        "text": "populasi"
      },
      {
        "cell": "O1",
        "text": "BY"
      },
      {
        "cell": "A2",
        "text": "PT. BENIH HARAKA SEJAHTERA"
      },
      {
        "cell": "G2",
        "text": "BY"
      },
      {
        "cell": "J2",
        "text": "BY"
      },
      {
        "cell": "N2",
        "text": "1000"
      },
      {
        "cell": "A3",
        "text": "Update :28/09/2026",
        "formula": "='Rincian Ketersediaan SS'!$B$1",
        "bg": "#FFFF00"
      }
    ],
    "columns": [
      {
        "key": "A",
        "label": "NO.",
        "width": 56
      },
      {
        "key": "B",
        "label": "PRODUCT",
        "width": 222
      },
      {
        "key": "C",
        "label": "KODE PRODUKSI",
        "width": 89
      },
      {
        "key": "D",
        "label": "BY",
        "width": 102
      },
      {
        "key": "E",
        "label": "Bobot 1000 Butir (gr)",
        "width": 79
      },
      {
        "key": "F",
        "label": "TOTAL TARGET (Kg)",
        "width": 65
      },
      {
        "key": "G",
        "label": "KETERANGAN",
        "width": 131
      },
      {
        "key": "H",
        "group": "StockSeed Tersedia (gr)",
        "label": "Male",
        "width": 87,
        "formula": "=SUMIF('Rincian Ketersediaan SS'!C:C,C{r},'Rincian Ketersediaan SS'!J:J)"
      },
      {
        "key": "I",
        "group": "StockSeed Tersedia (gr)",
        "label": "Female",
        "width": 110,
        "formula": "=SUMIF('Rincian Ketersediaan SS'!C:C,C{r},'Rincian Ketersediaan SS'!K:K)"
      },
      {
        "key": "J",
        "group": "StockSeed Tersedia (Populasi/Ha)",
        "label": "Male",
        "width": 85,
        "formula": "=(H{r}*1000)/E{r}"
      },
      {
        "key": "K",
        "group": "StockSeed Tersedia (Populasi/Ha)",
        "label": "Female",
        "width": 92,
        "formula": "=(I{r}*1000)/E{r}"
      },
      {
        "key": "L",
        "group": "StockSeed Tersedia Setara Target (Kg)",
        "label": "Male",
        "width": 96,
        "formula": "=(J{r}*D{r})/1000"
      },
      {
        "key": "M",
        "group": "StockSeed Tersedia Setara Target (Kg)",
        "label": "Female",
        "width": 85,
        "formula": "=(K{r}*D{r})/1000"
      },
      {
        "key": "N",
        "group": "Ratio StockSeed",
        "label": "Male",
        "width": 75,
        "formula": "=L{r}/L{r}"
      },
      {
        "key": "O",
        "group": "Ratio StockSeed",
        "label": "Female",
        "width": 75,
        "formula": "=M{r}/L{r}"
      },
      {
        "key": "P",
        "group": "Progress StockSeed Male (gr)",
        "label": "Progress (gr)",
        "width": 56
      },
      {
        "key": "Q",
        "group": "Progress StockSeed Male (gr)",
        "label": "Bulan",
        "width": 56
      },
      {
        "key": "R",
        "group": "Progress StockSeed Female (gr)",
        "label": "Progress (gr)",
        "width": 56
      },
      {
        "key": "S",
        "group": "Progress StockSeed Female (gr)",
        "label": "Bulan",
        "width": 56
      }
    ]
  },
  {
    "key": "rincian-ss",
    "title": "Rincian Ketersediaan SS",
    "excelName": "Rincian Ketersediaan SS",
    "workbook": "ketersediaan",
    "module": "stok_bahan",
    "headerRows": [
      2,
      3
    ],
    "dataStart": 4,
    "notes": [
      {
        "cell": "B1",
        "text": "Update :28/09/2026"
      }
    ],
    "columns": [
      {
        "key": "A",
        "label": "NO.",
        "width": 56
      },
      {
        "key": "B",
        "label": "PRODUCT",
        "width": 235
      },
      {
        "key": "C",
        "label": "KODE PRODUKSI",
        "width": 119
      },
      {
        "key": "D",
        "group": "TANGGAL MASUK",
        "label": "Male",
        "width": 95,
        "type": "date"
      },
      {
        "key": "E",
        "group": "TANGGAL MASUK",
        "label": "Female",
        "width": 93,
        "type": "date"
      },
      {
        "key": "F",
        "group": "NAMA PETANI",
        "label": "Male",
        "width": 96
      },
      {
        "key": "G",
        "group": "NAMA PETANI",
        "label": "Female",
        "width": 198
      },
      {
        "key": "H",
        "group": "NO LOT",
        "label": "Male",
        "width": 126
      },
      {
        "key": "I",
        "group": "NO LOT",
        "label": "Female",
        "width": 105
      },
      {
        "key": "J",
        "group": "Stock Seed Tersedia (gr)",
        "label": "Male",
        "width": 87
      },
      {
        "key": "K",
        "group": "Stock Seed Tersedia (gr)",
        "label": "Female",
        "width": 121
      },
      {
        "key": "L",
        "group": "PENGUJIAN M",
        "label": "Tanggal PCB",
        "width": 100,
        "type": "date"
      },
      {
        "key": "M",
        "group": "PENGUJIAN M",
        "label": "TGL LULUS",
        "width": 100,
        "type": "date"
      },
      {
        "key": "N",
        "group": "PENGUJIAN M",
        "label": "KA",
        "width": 86
      },
      {
        "key": "O",
        "group": "PENGUJIAN M",
        "label": "DB",
        "width": 65
      },
      {
        "key": "P",
        "label": "Tanggal PCB",
        "width": 108,
        "type": "date"
      },
      {
        "key": "Q",
        "group": "Pengujian F",
        "label": "TGL LULUS",
        "width": 95,
        "type": "date"
      },
      {
        "key": "R",
        "label": "KA",
        "width": 75
      },
      {
        "key": "S",
        "label": "DB",
        "width": 75
      },
      {
        "key": "T",
        "label": "KETERANGAN",
        "width": 260
      },
      {
        "key": "U",
        "label": "U",
        "width": 75
      },
      {
        "key": "V",
        "group": "Menurut Buku Induk (otomatis per LOT)",
        "width": 110,
        "label": "Masuk Male (gr)",
        "computed": "=IF(H{r}=\"\",\"\",SUMIF('SS Masuk BENIH INTERNAL '!K:K,H{r},'SS Masuk BENIH INTERNAL '!I:I)+SUMIF('SS MASUK NH'!K:K,H{r},'SS MASUK NH'!I:I))"
      },
      {
        "key": "W",
        "group": "Menurut Buku Induk (otomatis per LOT)",
        "width": 110,
        "label": "Keluar Male (gr)",
        "computed": "=IF(H{r}=\"\",\"\",SUMIF('SS KELUAR BENIH INTERNAL'!Q:Q,H{r},'SS KELUAR BENIH INTERNAL'!O:O)+SUMIF('SS Keluar NH'!P:P,H{r},'SS Keluar NH'!N:N))"
      },
      {
        "key": "X",
        "group": "Menurut Buku Induk (otomatis per LOT)",
        "width": 110,
        "label": "Sisa Male (gr)",
        "computed": "=IF(H{r}=\"\",\"\",V{r}-W{r})"
      },
      {
        "key": "Y",
        "group": "Menurut Buku Induk (otomatis per LOT)",
        "width": 110,
        "label": "Masuk Female (gr)",
        "computed": "=IF(I{r}=\"\",\"\",SUMIF('SS Masuk BENIH INTERNAL '!K:K,I{r},'SS Masuk BENIH INTERNAL '!I:I)+SUMIF('SS MASUK NH'!K:K,I{r},'SS MASUK NH'!I:I))"
      },
      {
        "key": "Z",
        "group": "Menurut Buku Induk (otomatis per LOT)",
        "width": 110,
        "label": "Keluar Female (gr)",
        "computed": "=IF(I{r}=\"\",\"\",SUMIF('SS KELUAR BENIH INTERNAL'!R:R,I{r},'SS KELUAR BENIH INTERNAL'!P:P)+SUMIF('SS Keluar NH'!Q:Q,I{r},'SS Keluar NH'!O:O))"
      },
      {
        "key": "AA",
        "group": "Menurut Buku Induk (otomatis per LOT)",
        "width": 110,
        "label": "Sisa Female (gr)",
        "computed": "=IF(I{r}=\"\",\"\",Y{r}-Z{r})"
      }
    ]
  },
  {
    "key": "rekap-rincian-ss",
    "title": "Rekap Rincian Ketersediaan SS",
    "excelName": "Rekap Rincian Ketersediaan SS",
    "workbook": "ketersediaan",
    "module": "stok_bahan",
    "headerRows": [
      1
    ],
    "dataStart": 2,
    "notes": [],
    "columns": [
      {
        "key": "A",
        "label": "NO",
        "width": 75
      },
      {
        "key": "B",
        "label": "NAMA PRODUK",
        "width": 227
      },
      {
        "key": "C",
        "label": "Kode Produksi",
        "width": 94
      },
      {
        "key": "D",
        "label": "M",
        "width": 85,
        "formula": "=SUMIF('Rincian Ketersediaan SS'!C:C,C{r},'Rincian Ketersediaan SS'!J:J)"
      },
      {
        "key": "E",
        "label": "F",
        "width": 96,
        "formula": "=SUMIF('Rincian Ketersediaan SS'!C:C,C{r},'Rincian Ketersediaan SS'!K:K)"
      }
    ]
  },
  {
    "key": "uji-ss",
    "title": "UJI SS",
    "excelName": "UJI SS",
    "workbook": "ketersediaan",
    "module": "stok_bahan",
    "headerRows": [
      3,
      4
    ],
    "dataStart": 5,
    "notes": [
      {
        "cell": "A1",
        "text": "List Uji Servise Benih"
      }
    ],
    "columns": [
      {
        "key": "A",
        "label": "Kode Produksi",
        "width": 75
      },
      {
        "key": "B",
        "label": "OP/M/F",
        "width": 75
      },
      {
        "key": "C",
        "label": "No Batch",
        "width": 75
      },
      {
        "key": "D",
        "group": "Uji Pertama",
        "label": "Tgl",
        "width": 92,
        "type": "date"
      },
      {
        "key": "E",
        "group": "Uji Pertama",
        "label": "DB",
        "width": 75
      },
      {
        "key": "F",
        "group": "Uji Service",
        "label": "Tgl",
        "width": 92,
        "type": "date"
      },
      {
        "key": "G",
        "group": "Uji Service",
        "label": "DB",
        "width": 75
      },
      {
        "key": "H",
        "group": "Uji Service",
        "label": "Tgl",
        "width": 75
      },
      {
        "key": "I",
        "group": "Uji Service",
        "label": "DB",
        "width": 75
      },
      {
        "key": "J",
        "group": "Uji Service",
        "label": "Tgl",
        "width": 75
      },
      {
        "key": "K",
        "group": "Uji Service",
        "label": "DB",
        "width": 75
      }
    ]
  },
  {
    "key": "uji-ss-2",
    "title": "UJI SS (2)",
    "excelName": "UJI SS (2)",
    "workbook": "ketersediaan",
    "module": "stok_bahan",
    "headerRows": [
      3,
      4
    ],
    "dataStart": 5,
    "notes": [
      {
        "cell": "A1",
        "text": "List Uji Servise Benih"
      }
    ],
    "columns": [
      {
        "key": "A",
        "label": "Kode Produksi",
        "width": 75
      },
      {
        "key": "B",
        "label": "OP/M/F",
        "width": 75
      },
      {
        "key": "C",
        "label": "LOT",
        "width": 75
      },
      {
        "key": "D",
        "label": "gr",
        "width": 75
      },
      {
        "key": "E",
        "label": "Tgl PCB",
        "width": 92,
        "type": "date"
      },
      {
        "key": "F",
        "group": "Uji Service",
        "label": "Tgl",
        "width": 92,
        "type": "date"
      },
      {
        "key": "G",
        "group": "Uji Service",
        "label": "DB",
        "width": 75
      },
      {
        "key": "H",
        "group": "Uji Service",
        "label": "Tgl",
        "width": 75
      },
      {
        "key": "I",
        "group": "Uji Service",
        "label": "DB",
        "width": 75
      },
      {
        "key": "J",
        "group": "Uji Service",
        "label": "Tgl",
        "width": 75
      },
      {
        "key": "K",
        "group": "Uji Service",
        "label": "DB",
        "width": 75
      }
    ]
  },
  {
    "key": "catatan-ss",
    "title": "Catatan",
    "excelName": "Catatan",
    "workbook": "ketersediaan",
    "module": "stok_bahan",
    "headerRows": [
      1
    ],
    "dataStart": 2,
    "notes": [],
    "columns": [
      {
        "key": "A",
        "label": "Kode Produksi",
        "width": 103
      },
      {
        "key": "B",
        "label": "Nama Produk",
        "width": 103
      },
      {
        "key": "C",
        "label": "Male",
        "width": 103
      },
      {
        "key": "D",
        "label": "Female",
        "width": 103
      },
      {
        "key": "E",
        "label": "E",
        "width": 75
      },
      {
        "key": "F",
        "label": "F",
        "width": 75
      },
      {
        "key": "G",
        "label": "G",
        "width": 75
      },
      {
        "key": "H",
        "label": "H",
        "width": 75
      }
    ]
  },
  {
    "key": "ketersediaan-bs",
    "title": "Ketersediaan BS",
    "excelName": "Ketersediaan BS",
    "workbook": "ketersediaan",
    "module": "stok_bahan",
    "headerRows": [
      3,
      4
    ],
    "dataStart": 5,
    "notes": [
      {
        "cell": "B1",
        "text": "Bobot BS"
      }
    ],
    "columns": [
      {
        "key": "A",
        "label": "No",
        "width": 75
      },
      {
        "key": "B",
        "label": "Kode Produksi",
        "width": 106
      },
      {
        "key": "C",
        "group": "BS Tersedia (gr)",
        "label": "M",
        "width": 75
      },
      {
        "key": "D",
        "group": "BS Tersedia (gr)",
        "label": "F",
        "width": 75
      }
    ]
  },
  {
    "key": "plan-perbanyakan-ss",
    "title": "Plan Perbanyakan SS",
    "excelName": "Plan Perbanyakan SS",
    "workbook": "ketersediaan",
    "module": "stok_bahan",
    "headerRows": [
      2
    ],
    "dataStart": 3,
    "notes": [
      {
        "cell": "A1",
        "text": "PLAN PERBANYAKAN SS TAHUN 2023"
      }
    ],
    "columns": [
      {
        "key": "A",
        "label": "Kode Produksi",
        "width": 69
      },
      {
        "key": "B",
        "label": "Target (kg)",
        "width": 59
      },
      {
        "key": "C",
        "label": "BY (gr)",
        "width": 56
      },
      {
        "key": "D",
        "label": "Pop Prod (tanaman)",
        "width": 81,
        "formula": "=B{r}/C{r}*1000"
      },
      {
        "key": "E",
        "label": "Pop yang ditanam Prod (tanaman)",
        "width": 115
      },
      {
        "key": "F",
        "label": "Bobot 1000 butir (gr)",
        "width": 80
      },
      {
        "key": "G",
        "label": "Kebutuhan SS (gr)",
        "width": 81,
        "formula": "=E{r}*F{r}/1000"
      },
      {
        "key": "H",
        "label": "Pop RD (tanaman)",
        "width": 81,
        "formula": "=G{r}/C{r}"
      },
      {
        "key": "I",
        "label": "Pop yang ditanam RD (tanaman)",
        "width": 108
      },
      {
        "key": "J",
        "label": "Ket",
        "width": 75
      }
    ]
  }
];
