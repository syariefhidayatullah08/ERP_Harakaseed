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
        "width": 58,
        "s": 0
      },
      {
        "key": "B",
        "label": "NO. KONTRAK",
        "width": 96,
        "s": 0
      },
      {
        "key": "C",
        "label": "VARIETAS",
        "width": 165,
        "s": 0
      },
      {
        "key": "D",
        "label": "KODE PRODUKSI",
        "width": 142,
        "s": 0
      },
      {
        "key": "E",
        "label": "M/F/OP",
        "width": 111,
        "s": 0
      },
      {
        "key": "F",
        "label": "PETANI",
        "width": 205,
        "s": 0
      },
      {
        "key": "G",
        "label": "PETUGAS",
        "width": 95,
        "s": 0
      },
      {
        "key": "H",
        "label": "TANGGAL BENIH MASUK",
        "width": 91,
        "s": 0,
        "type": "date"
      },
      {
        "key": "I",
        "label": "BOBOT (gr)",
        "width": 66,
        "s": 0,
        "fmt": "#,##0"
      },
      {
        "key": "J",
        "label": "BOBOT SETELAH PROSES + PCB (gr)",
        "width": 148,
        "s": 0
      },
      {
        "key": "K",
        "label": "NO LOT",
        "width": 123,
        "s": 0
      },
      {
        "key": "L",
        "label": "TGL MASUK LAB",
        "width": 125,
        "s": 0,
        "type": "date"
      },
      {
        "key": "M",
        "label": "KETERANGAN",
        "width": 216,
        "s": 0
      }
    ],
    "head": {
      "rows": 6,
      "cells": {
        "A1": {
          "s": 1
        },
        "B1": {
          "s": 2
        },
        "C1": {
          "s": 3
        },
        "D1": {
          "s": 3
        },
        "E1": {
          "s": 3
        },
        "F1": {
          "s": 1
        },
        "G1": {
          "s": 1
        },
        "H1": {
          "s": 4
        },
        "I1": {
          "s": 5
        },
        "J1": {
          "s": 5
        },
        "K1": {
          "s": 3
        },
        "A2": {
          "s": 1
        },
        "B2": {
          "s": 2
        },
        "C2": {
          "t": "BUKU INDUK MAMPU TELUSUR SS MASUK INTERNAL",
          "s": 6
        },
        "A3": {
          "s": 1
        },
        "B3": {
          "s": 2
        },
        "C3": {
          "t": "PT. BENIH HARAKA SEJAHTERA (PERIODE 2025)",
          "s": 7
        },
        "A4": {
          "s": 1
        },
        "B4": {
          "s": 2
        },
        "C4": {
          "s": 8
        },
        "D4": {
          "s": 8
        },
        "E4": {
          "s": 8
        },
        "F4": {
          "s": 7
        },
        "G4": {
          "s": 7
        },
        "H4": {
          "s": 9
        },
        "I4": {
          "s": 10
        },
        "J4": {
          "s": 10
        },
        "K4": {
          "s": 7
        },
        "L4": {
          "s": 7
        },
        "A5": {
          "t": "NO.",
          "s": 11
        },
        "B5": {
          "t": "NO. KONTRAK",
          "s": 12
        },
        "C5": {
          "t": "VARIETAS",
          "s": 13
        },
        "D5": {
          "t": "KODE PRODUKSI",
          "s": 13
        },
        "E5": {
          "t": "M/F/OP",
          "s": 13
        },
        "F5": {
          "t": "PETANI",
          "s": 13
        },
        "G5": {
          "t": "PETUGAS",
          "s": 13
        },
        "H5": {
          "t": "TANGGAL BENIH MASUK",
          "s": 13
        },
        "I5": {
          "t": "BOBOT (gr)",
          "s": 13
        },
        "J5": {
          "t": "BOBOT SETELAH PROSES + PCB (gr)",
          "s": 13
        },
        "K5": {
          "t": "NO LOT",
          "s": 13
        },
        "L5": {
          "t": "TGL MASUK LAB",
          "s": 13
        },
        "M5": {
          "t": "KETERANGAN",
          "s": 13
        }
      },
      "heights": {
        "2": 28,
        "3": 21,
        "4": 21,
        "6": 66
      },
      "merges": [
        "M5:M6",
        "C2:L2",
        "C3:L3",
        "A5:A6",
        "B5:B6",
        "C5:C6",
        "D5:D6",
        "E5:E6",
        "F5:F6",
        "G5:G6",
        "H5:H6",
        "I5:I6",
        "J5:J6",
        "K5:K6",
        "L5:L6"
      ]
    },
    "styles": [
      {
        "h": "center",
        "bd": "trbl"
      },
      {
        "h": "center",
        "v": "top"
      },
      {
        "h": "left",
        "v": "top"
      },
      {
        "h": "center",
        "v": "middle"
      },
      {
        "h": "right",
        "v": "middle"
      },
      {
        "h": "right",
        "v": "top"
      },
      {
        "b": 1,
        "z": 16,
        "h": "center",
        "v": "middle"
      },
      {
        "b": 1,
        "z": 12,
        "h": "center",
        "v": "top"
      },
      {
        "b": 1,
        "z": 12,
        "h": "center",
        "v": "middle"
      },
      {
        "b": 1,
        "z": 12,
        "h": "right",
        "v": "middle"
      },
      {
        "b": 1,
        "z": 12,
        "h": "right",
        "v": "top"
      },
      {
        "b": 1,
        "z": 10,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "bd": "TLrB"
      },
      {
        "b": 1,
        "z": 10,
        "f": "#FFFF00",
        "h": "left",
        "v": "middle",
        "w": 1,
        "bd": "TlrB"
      },
      {
        "b": 1,
        "z": 10,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "TlrB"
      }
    ],
    "freeze": {
      "x": 0,
      "y": 6
    },
    "rowHeight": 19
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
        "width": 104,
        "s": 0,
        "type": "date"
      },
      {
        "key": "B",
        "label": "Tanggal penyiapan benih sumber",
        "width": 133,
        "s": 0,
        "type": "date"
      },
      {
        "key": "C",
        "label": "Petugas",
        "width": 85,
        "s": 0
      },
      {
        "key": "D",
        "label": "Petani",
        "width": 161,
        "s": 0
      },
      {
        "key": "E",
        "label": "Alamat",
        "width": 282,
        "s": 0,
        "fmt": "_(* #,##0.00_);_(* (#,##0.00);_(* \"-\"??_);_(@_)"
      },
      {
        "key": "F",
        "label": "No Kontrak",
        "width": 103,
        "s": 0
      },
      {
        "key": "G",
        "label": "Blok",
        "width": 69,
        "s": 1
      },
      {
        "key": "H",
        "label": "Status",
        "width": 158,
        "s": 0
      },
      {
        "key": "I",
        "label": "Kode Produksi",
        "width": 141,
        "s": 0
      },
      {
        "key": "J",
        "label": "Varietas",
        "width": 97,
        "s": 0
      },
      {
        "key": "K",
        "label": "Luas lahan (ha)",
        "width": 91,
        "s": 0
      },
      {
        "key": "L",
        "label": "Pop",
        "width": 93,
        "s": 0,
        "fmt": "#,##0"
      },
      {
        "key": "M",
        "label": "Target (kg)",
        "width": 55,
        "s": 0
      },
      {
        "key": "N",
        "label": "Bobot 1000 btr",
        "width": 64,
        "s": 0
      },
      {
        "key": "O",
        "label": "Male (gr)",
        "width": 51,
        "s": 0,
        "formula": "=P{r}/4"
      },
      {
        "key": "P",
        "label": "Female (gr)",
        "width": 91,
        "s": 0,
        "fmt": "#,##0",
        "formula": "=L{r}/1000*N{r}*120%"
      },
      {
        "key": "Q",
        "label": "LOT MALE",
        "width": 153,
        "s": 0
      },
      {
        "key": "R",
        "label": "LOT FEMALE",
        "width": 226,
        "s": 0
      },
      {
        "key": "S",
        "label": "MALE",
        "width": 99,
        "s": 0
      },
      {
        "key": "T",
        "label": "FEMALE",
        "width": 99,
        "s": 0,
        "fmt": "_-* #,##0.00_-;-* #,##0.00_-;_-* \"-\"_-;_-@_-"
      },
      {
        "key": "U",
        "label": "Ket",
        "width": 421,
        "s": 0
      }
    ],
    "head": {
      "rows": 6,
      "cells": {
        "A1": {
          "s": 2
        },
        "B1": {
          "s": 2
        },
        "C1": {
          "s": 3
        },
        "D1": {
          "s": 2
        },
        "E1": {
          "s": 2
        },
        "F1": {
          "s": 2
        },
        "G1": {
          "s": 4
        },
        "H1": {
          "s": 2
        },
        "I1": {
          "s": 2
        },
        "J1": {
          "s": 2
        },
        "K1": {
          "s": 3
        },
        "L1": {
          "s": 2
        },
        "M1": {
          "s": 2
        },
        "N1": {
          "s": 2
        },
        "O1": {
          "s": 2
        },
        "P1": {
          "s": 2
        },
        "Q1": {
          "s": 5
        },
        "R1": {
          "s": 5
        },
        "S1": {
          "s": 5
        },
        "T1": {
          "s": 5
        },
        "U1": {
          "s": 4
        },
        "A2": {
          "s": 2
        },
        "B2": {
          "s": 2
        },
        "C2": {
          "s": 3
        },
        "D2": {
          "t": "REKAPITULASI BENIH SUMBER KELUAR",
          "s": 6
        },
        "Q2": {
          "s": 7
        },
        "R2": {
          "s": 7
        },
        "S2": {
          "s": 7
        },
        "T2": {
          "s": 7
        },
        "U2": {
          "s": 8
        },
        "A3": {
          "s": 2
        },
        "B3": {
          "s": 2
        },
        "C3": {
          "s": 3
        },
        "D3": {
          "t": "PT. BENIH HARAKA SEJAHTERA (PERIODE 2026)",
          "s": 9
        },
        "Q3": {
          "s": 10
        },
        "R3": {
          "t": "Eksternal",
          "s": 11
        },
        "S3": {
          "s": 11
        },
        "T3": {
          "s": 11
        },
        "U3": {
          "s": 12
        },
        "A4": {
          "s": 2
        },
        "B4": {
          "s": 2
        },
        "C4": {
          "s": 3
        },
        "D4": {
          "s": 9
        },
        "E4": {
          "s": 9
        },
        "F4": {
          "s": 9
        },
        "G4": {
          "s": 9
        },
        "H4": {
          "s": 9
        },
        "I4": {
          "s": 9
        },
        "J4": {
          "s": 9
        },
        "K4": {
          "s": 9
        },
        "L4": {
          "s": 9
        },
        "M4": {
          "s": 9
        },
        "N4": {
          "s": 9
        },
        "O4": {
          "s": 9
        },
        "P4": {
          "s": 9
        },
        "Q4": {
          "s": 13
        },
        "R4": {
          "t": "ISO",
          "s": 11
        },
        "S4": {
          "s": 11
        },
        "T4": {
          "s": 11
        },
        "U4": {
          "s": 12
        },
        "A5": {
          "s": 2
        },
        "B5": {
          "s": 2
        },
        "C5": {
          "s": 3
        },
        "D5": {
          "s": 9
        },
        "E5": {
          "s": 9
        },
        "F5": {
          "s": 9
        },
        "G5": {
          "s": 14
        },
        "H5": {
          "s": 9
        },
        "I5": {
          "s": 9
        },
        "J5": {
          "s": 9
        },
        "K5": {
          "s": 15
        },
        "L5": {
          "s": 9
        },
        "M5": {
          "s": 9
        },
        "N5": {
          "s": 9
        },
        "O5": {
          "s": 9
        },
        "P5": {
          "s": 9
        },
        "Q5": {
          "s": 16
        },
        "R5": {
          "t": "Bukan kontrak baru",
          "s": 11
        },
        "S5": {
          "s": 11
        },
        "T5": {
          "s": 11
        },
        "U5": {
          "s": 9
        },
        "A6": {
          "t": "Tanggal Pengajuan Benih Sumber",
          "s": 17
        },
        "B6": {
          "t": "Tanggal penyiapan benih sumber",
          "s": 18
        },
        "C6": {
          "t": "Petugas",
          "s": 19
        },
        "D6": {
          "t": "Petani",
          "s": 19
        },
        "E6": {
          "t": "Alamat",
          "s": 19
        },
        "F6": {
          "t": "No Kontrak",
          "s": 19
        },
        "G6": {
          "t": "Blok",
          "s": 19
        },
        "H6": {
          "t": "Status",
          "s": 19
        },
        "I6": {
          "t": "Kode Produksi",
          "s": 19
        },
        "J6": {
          "t": "Varietas",
          "s": 19
        },
        "K6": {
          "t": "Luas lahan (ha)",
          "s": 19
        },
        "L6": {
          "t": "Pop",
          "s": 19
        },
        "M6": {
          "t": "Target (kg)",
          "s": 19
        },
        "N6": {
          "t": "Bobot 1000 btr",
          "s": 19
        },
        "O6": {
          "t": "Male (gr)",
          "s": 19
        },
        "P6": {
          "t": "Female (gr)",
          "s": 19
        },
        "Q6": {
          "t": "LOT MALE",
          "s": 20
        },
        "R6": {
          "t": "LOT FEMALE",
          "s": 21
        },
        "S6": {
          "t": "MALE",
          "s": 22
        },
        "T6": {
          "t": "FEMALE",
          "s": 23
        },
        "U6": {
          "t": "Ket",
          "s": 24
        }
      },
      "heights": {
        "2": 28,
        "3": 21,
        "4": 21,
        "5": 21,
        "6": 63
      },
      "merges": [
        "D2:P2",
        "D3:P3"
      ]
    },
    "styles": [
      {
        "h": "center",
        "bd": "trbl"
      },
      {
        "h": "center",
        "v": "middle",
        "bd": "trbl"
      },
      {
        "h": "center",
        "v": "top"
      },
      {
        "h": "left",
        "v": "top"
      },
      {
        "h": "center",
        "v": "middle"
      },
      {
        "h": "right",
        "v": "top"
      },
      {
        "b": 1,
        "z": 16,
        "h": "center",
        "v": "middle"
      },
      {
        "b": 1,
        "z": 16,
        "h": "right",
        "v": "middle"
      },
      {
        "b": 1,
        "z": 16,
        "v": "middle"
      },
      {
        "b": 1,
        "z": 12,
        "h": "center",
        "v": "top"
      },
      {
        "b": 1,
        "z": 12,
        "f": "#00B0F0",
        "h": "right",
        "v": "top"
      },
      {
        "b": 1,
        "z": 12,
        "h": "right",
        "v": "top"
      },
      {
        "b": 1,
        "z": 12,
        "v": "top"
      },
      {
        "b": 1,
        "z": 12,
        "f": "#FFFF00",
        "h": "right",
        "v": "top"
      },
      {
        "b": 1,
        "z": 12,
        "h": "center",
        "v": "middle"
      },
      {
        "b": 1,
        "z": 12,
        "h": "left",
        "v": "top"
      },
      {
        "b": 1,
        "z": 12,
        "f": "#92D050",
        "h": "right",
        "v": "top"
      },
      {
        "b": 1,
        "z": 12,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "TrBL"
      },
      {
        "b": 1,
        "z": 12,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "TrB"
      },
      {
        "b": 1,
        "z": 12,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "TrBl"
      },
      {
        "b": 1,
        "z": 12,
        "f": "#BDD7EE",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "TrBl"
      },
      {
        "b": 1,
        "z": 12,
        "f": "#F2AAEB",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "TrBl"
      },
      {
        "b": 1,
        "z": 12,
        "f": "#BDD7EE",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "TBl"
      },
      {
        "b": 1,
        "z": 12,
        "f": "#F2AAEB",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "TBl"
      },
      {
        "b": 1,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "TRBl"
      }
    ],
    "freeze": {
      "x": 0,
      "y": 6
    },
    "rowHeight": 19
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
        "width": 58,
        "s": 0
      },
      {
        "key": "B",
        "label": "NO SURAT NH",
        "width": 184,
        "s": 0
      },
      {
        "key": "C",
        "label": "VARIETAS",
        "width": 116,
        "s": 1
      },
      {
        "key": "D",
        "label": "KODE PRODUKSI",
        "width": 107,
        "s": 1
      },
      {
        "key": "E",
        "label": "M/F/OP",
        "width": 118,
        "s": 1
      },
      {
        "key": "F",
        "label": "PETANI",
        "width": 92,
        "s": 1
      },
      {
        "key": "G",
        "label": "TANGGAL SURAT PENGAJUAN",
        "width": 123,
        "s": 1,
        "type": "date"
      },
      {
        "key": "H",
        "label": "TANGGAL BENIH MASUK",
        "width": 91,
        "s": 1,
        "type": "date"
      },
      {
        "key": "I",
        "label": "BOBOT (gr)",
        "width": 87,
        "s": 1
      },
      {
        "key": "J",
        "label": "BOBOT SETELAH PROSES + PCB (gr)",
        "width": 148,
        "s": 1
      },
      {
        "key": "K",
        "label": "NO LOT",
        "width": 123,
        "s": 1
      },
      {
        "key": "L",
        "label": "POPULASI",
        "width": 123,
        "s": 2,
        "fmt": "#,##0"
      },
      {
        "key": "M",
        "label": "TGL MASUK LAB",
        "width": 125,
        "s": 1
      },
      {
        "key": "N",
        "label": "KETERANGAN",
        "width": 219,
        "s": 1
      }
    ],
    "head": {
      "rows": 6,
      "cells": {
        "A1": {
          "s": 3
        },
        "B1": {
          "s": 3
        },
        "C1": {
          "s": 4
        },
        "D1": {
          "s": 4
        },
        "E1": {
          "s": 4
        },
        "F1": {
          "s": 3
        },
        "G1": {
          "s": 3
        },
        "H1": {
          "s": 5
        },
        "I1": {
          "s": 6
        },
        "J1": {
          "s": 6
        },
        "K1": {
          "s": 4
        },
        "L1": {
          "s": 4
        },
        "A2": {
          "s": 3
        },
        "B2": {
          "s": 3
        },
        "C2": {
          "t": "BUKU INDUK MAMPU TELUSUR SS MASUK INTERNAL",
          "s": 7
        },
        "A3": {
          "s": 3
        },
        "B3": {
          "s": 3
        },
        "C3": {
          "t": "PT. BENIH HARAKA SEJAHTERA (PERIODE 2026)",
          "s": 8
        },
        "A4": {
          "s": 3
        },
        "B4": {
          "s": 3
        },
        "C4": {
          "s": 9
        },
        "D4": {
          "s": 9
        },
        "E4": {
          "s": 9
        },
        "F4": {
          "s": 8
        },
        "G4": {
          "s": 8
        },
        "H4": {
          "s": 10
        },
        "I4": {
          "s": 11
        },
        "J4": {
          "s": 11
        },
        "K4": {
          "s": 8
        },
        "L4": {
          "s": 8
        },
        "M4": {
          "s": 8
        },
        "A5": {
          "t": "NO.",
          "s": 12
        },
        "B5": {
          "t": "NO SURAT NH",
          "s": 13
        },
        "C5": {
          "t": "VARIETAS",
          "s": 14
        },
        "D5": {
          "t": "KODE PRODUKSI",
          "s": 15
        },
        "E5": {
          "t": "M/F/OP",
          "s": 15
        },
        "F5": {
          "t": "PETANI",
          "s": 15
        },
        "G5": {
          "t": "TANGGAL SURAT PENGAJUAN",
          "s": 15
        },
        "H5": {
          "t": "TANGGAL BENIH MASUK",
          "s": 14
        },
        "I5": {
          "t": "BOBOT (gr)",
          "s": 14
        },
        "J5": {
          "t": "BOBOT SETELAH PROSES + PCB (gr)",
          "s": 14
        },
        "K5": {
          "t": "NO LOT",
          "s": 14
        },
        "L5": {
          "t": "POPULASI",
          "s": 14
        },
        "M5": {
          "t": "TGL MASUK LAB",
          "s": 14
        },
        "N5": {
          "t": "KETERANGAN",
          "s": 14
        }
      },
      "heights": {
        "2": 28,
        "3": 21,
        "4": 21,
        "6": 66
      },
      "merges": [
        "N5:N6",
        "G5:G6",
        "I5:I6",
        "J5:J6",
        "K5:K6",
        "M5:M6",
        "L5:L6",
        "A5:A6",
        "C5:C6",
        "D5:D6",
        "E5:E6",
        "F5:F6",
        "B5:B6",
        "C2:M2",
        "C3:M3",
        "H5:H6"
      ]
    },
    "styles": [
      {
        "h": "center",
        "bd": "rbl"
      },
      {
        "h": "center",
        "bd": "trbl"
      },
      {
        "h": "center",
        "v": "middle",
        "bd": "trl"
      },
      {
        "h": "center",
        "v": "top"
      },
      {
        "h": "center",
        "v": "middle"
      },
      {
        "h": "right",
        "v": "middle"
      },
      {
        "h": "right",
        "v": "top"
      },
      {
        "b": 1,
        "z": 16,
        "h": "center",
        "v": "middle"
      },
      {
        "b": 1,
        "z": 12,
        "h": "center",
        "v": "top"
      },
      {
        "b": 1,
        "z": 12,
        "h": "center",
        "v": "middle"
      },
      {
        "b": 1,
        "z": 12,
        "h": "right",
        "v": "middle"
      },
      {
        "b": 1,
        "z": 12,
        "h": "right",
        "v": "top"
      },
      {
        "b": 1,
        "z": 10,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "bd": "TLrB"
      },
      {
        "b": 1,
        "z": 10,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "bd": "TlrB"
      },
      {
        "b": 1,
        "z": 10,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "TlrB"
      },
      {
        "b": 1,
        "z": 10,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "Tlr"
      }
    ],
    "freeze": {
      "x": 0,
      "y": 6
    },
    "rowHeight": 19
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
        "width": 123,
        "s": 0,
        "type": "date"
      },
      {
        "key": "B",
        "label": "Penyiapan benih sumber",
        "width": 104,
        "s": 0,
        "type": "date"
      },
      {
        "key": "C",
        "label": "Petugas",
        "width": 70,
        "s": 0
      },
      {
        "key": "D",
        "label": "Petani",
        "width": 130,
        "s": 0
      },
      {
        "key": "E",
        "label": "Alamat",
        "width": 271,
        "s": 0
      },
      {
        "key": "F",
        "label": "No Kontrak",
        "width": 103,
        "s": 0
      },
      {
        "key": "G",
        "label": "Status",
        "width": 120,
        "s": 0
      },
      {
        "key": "H",
        "label": "Kode Produksi",
        "width": 76,
        "s": 0
      },
      {
        "key": "I",
        "label": "Varietas",
        "width": 81,
        "s": 0
      },
      {
        "key": "J",
        "label": "Luas lahan (ha)",
        "width": 65,
        "s": 0
      },
      {
        "key": "K",
        "label": "Pop",
        "width": 93,
        "s": 0
      },
      {
        "key": "L",
        "label": "Target (kg)",
        "width": 55,
        "s": 0
      },
      {
        "key": "M",
        "label": "Bobot 1000 btr",
        "width": 64,
        "s": 0
      },
      {
        "key": "N",
        "label": "Male (gr)",
        "width": 61,
        "s": 0,
        "formula": "=O{r}/4"
      },
      {
        "key": "O",
        "label": "Female (gr)",
        "width": 67,
        "s": 0,
        "fmt": "_-* #,##0.00_-;-* #,##0.00_-;_-* \"-\"_-;_-@_-",
        "formula": "=K{r}/1000*M{r}*120%"
      },
      {
        "key": "P",
        "label": "LOT MALE",
        "width": 163,
        "s": 0
      },
      {
        "key": "Q",
        "label": "LOT FEMALE",
        "width": 188,
        "s": 0
      },
      {
        "key": "R",
        "label": "STOCK MALE (gr)",
        "width": 188,
        "s": 0
      },
      {
        "key": "S",
        "label": "STOCK FEMALE (gr)",
        "width": 188,
        "s": 0
      },
      {
        "key": "T",
        "label": "Ket",
        "width": 819,
        "s": 1
      },
      {
        "key": "U",
        "label": "U",
        "width": 64,
        "s": 2
      }
    ],
    "head": {
      "rows": 7,
      "cells": {
        "A1": {
          "s": 3
        },
        "B1": {
          "s": 3
        },
        "C1": {
          "s": 4
        },
        "D1": {
          "s": 3
        },
        "E1": {
          "s": 3
        },
        "F1": {
          "s": 3
        },
        "G1": {
          "s": 3
        },
        "H1": {
          "s": 3
        },
        "I1": {
          "s": 3
        },
        "J1": {
          "s": 4
        },
        "K1": {
          "s": 3
        },
        "L1": {
          "s": 3
        },
        "M1": {
          "s": 3
        },
        "N1": {
          "s": 3
        },
        "O1": {
          "s": 3
        },
        "P1": {
          "s": 5
        },
        "Q1": {
          "s": 5
        },
        "R1": {
          "s": 5
        },
        "S1": {
          "s": 5
        },
        "T1": {
          "s": 6
        },
        "A2": {
          "s": 3
        },
        "B2": {
          "s": 3
        },
        "C2": {
          "s": 4
        },
        "D2": {
          "t": "REKAPITULASI BENIH SUMBER KELUAR",
          "s": 7
        },
        "P2": {
          "s": 8
        },
        "Q2": {
          "s": 8
        },
        "R2": {
          "s": 8
        },
        "S2": {
          "s": 8
        },
        "T2": {
          "s": 9
        },
        "U2": {
          "s": 9
        },
        "A3": {
          "s": 3
        },
        "B3": {
          "s": 3
        },
        "C3": {
          "s": 4
        },
        "D3": {
          "t": "PT. BENIH HARAKA SEJAHTERA (PERIODE 2026)",
          "s": 10
        },
        "P3": {
          "s": 11
        },
        "Q3": {
          "s": 12
        },
        "R3": {
          "s": 12
        },
        "S3": {
          "s": 12
        },
        "T3": {
          "t": "Bukan kontrak baru"
        },
        "U3": {
          "s": 13
        },
        "A4": {
          "s": 3
        },
        "B4": {
          "s": 3
        },
        "C4": {
          "s": 4
        },
        "D4": {
          "s": 10
        },
        "E4": {
          "s": 10
        },
        "F4": {
          "s": 10
        },
        "G4": {
          "s": 10
        },
        "H4": {
          "s": 10
        },
        "I4": {
          "s": 10
        },
        "J4": {
          "s": 10
        },
        "K4": {
          "s": 10
        },
        "L4": {
          "s": 10
        },
        "M4": {
          "s": 10
        },
        "N4": {
          "s": 10
        },
        "O4": {
          "s": 10
        },
        "P4": {
          "s": 11
        },
        "Q4": {
          "s": 14
        },
        "R4": {
          "s": 14
        },
        "S4": {
          "s": 14
        },
        "T4": {
          "t": "BUFFER"
        },
        "U4": {
          "s": 13
        },
        "A5": {
          "s": 3
        },
        "B5": {
          "s": 3
        },
        "C5": {
          "s": 4
        },
        "D5": {
          "s": 10
        },
        "E5": {
          "s": 10
        },
        "F5": {
          "s": 10
        },
        "G5": {
          "s": 10
        },
        "H5": {
          "s": 10
        },
        "I5": {
          "s": 10
        },
        "J5": {
          "s": 10
        },
        "K5": {
          "s": 10
        },
        "L5": {
          "s": 10
        },
        "M5": {
          "s": 10
        },
        "N5": {
          "s": 10
        },
        "O5": {
          "s": 10
        },
        "P5": {
          "s": 11
        },
        "Q5": {
          "s": 15
        },
        "R5": {
          "s": 15
        },
        "S5": {
          "s": 15
        },
        "T5": {
          "t": "Terminal"
        },
        "U5": {
          "s": 13
        },
        "A6": {
          "s": 3
        },
        "B6": {
          "s": 3
        },
        "C6": {
          "s": 4
        },
        "D6": {
          "s": 10
        },
        "E6": {
          "s": 10
        },
        "F6": {
          "s": 10
        },
        "G6": {
          "s": 10
        },
        "H6": {
          "s": 10
        },
        "I6": {
          "s": 10
        },
        "J6": {
          "s": 16
        },
        "K6": {
          "s": 10
        },
        "L6": {
          "s": 10
        },
        "M6": {
          "s": 10
        },
        "N6": {
          "s": 10
        },
        "O6": {
          "s": 10
        },
        "P6": {
          "s": 11
        },
        "Q6": {
          "s": 17
        },
        "R6": {
          "s": 17
        },
        "S6": {
          "s": 17
        },
        "T6": {
          "t": "Kontrak yang tidak urut",
          "s": 18
        },
        "U6": {
          "s": 10
        },
        "A7": {
          "t": "Tanggal Pengajuan Benih Sumber",
          "s": 19
        },
        "B7": {
          "t": "Penyiapan benih sumber",
          "s": 20
        },
        "C7": {
          "t": "Petugas",
          "s": 21
        },
        "D7": {
          "t": "Petani",
          "s": 21
        },
        "E7": {
          "t": "Alamat",
          "s": 21
        },
        "F7": {
          "t": "No Kontrak",
          "s": 21
        },
        "G7": {
          "t": "Status",
          "s": 21
        },
        "H7": {
          "t": "Kode Produksi",
          "s": 21
        },
        "I7": {
          "t": "Varietas",
          "s": 21
        },
        "J7": {
          "t": "Luas lahan (ha)",
          "s": 21
        },
        "K7": {
          "t": "Pop",
          "s": 21
        },
        "L7": {
          "t": "Target (kg)",
          "s": 21
        },
        "M7": {
          "t": "Bobot 1000 btr",
          "s": 21
        },
        "N7": {
          "t": "Male (gr)",
          "s": 21
        },
        "O7": {
          "t": "Female (gr)",
          "s": 21
        },
        "P7": {
          "t": "LOT MALE",
          "s": 22
        },
        "Q7": {
          "t": "LOT FEMALE",
          "s": 23
        },
        "R7": {
          "t": "STOCK MALE (gr)",
          "s": 24
        },
        "S7": {
          "t": "STOCK FEMALE (gr)",
          "s": 25
        },
        "T7": {
          "t": "Ket",
          "s": 26
        },
        "U7": {
          "s": 27
        }
      },
      "heights": {
        "2": 28,
        "3": 21,
        "4": 21,
        "5": 21,
        "6": 21,
        "7": 63
      },
      "merges": [
        "D2:O2",
        "D3:O3"
      ]
    },
    "styles": [
      {
        "h": "center",
        "bd": "trbl"
      },
      {
        "h": "left",
        "bd": "trbl"
      },
      {
        "h": "center"
      },
      {
        "h": "center",
        "v": "top"
      },
      {
        "h": "left",
        "v": "top"
      },
      {
        "h": "right",
        "v": "top"
      },
      {
        "h": "center",
        "v": "middle"
      },
      {
        "b": 1,
        "z": 16,
        "h": "center",
        "v": "middle"
      },
      {
        "b": 1,
        "z": 16,
        "h": "right",
        "v": "middle"
      },
      {
        "b": 1,
        "z": 16,
        "v": "middle"
      },
      {
        "b": 1,
        "z": 12,
        "h": "center",
        "v": "top"
      },
      {
        "b": 1,
        "z": 12,
        "h": "right",
        "v": "top"
      },
      {
        "f": "#A9CE91"
      },
      {
        "b": 1,
        "z": 12,
        "v": "top"
      },
      {
        "c": "#00B0F0",
        "f": "#00B0F0"
      },
      {
        "c": "#00B0F0",
        "f": "#FF0000"
      },
      {
        "b": 1,
        "z": 12,
        "h": "left",
        "v": "top"
      },
      {
        "f": "#FF33CC"
      },
      {
        "h": "left"
      },
      {
        "b": 1,
        "z": 12,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "TrBL"
      },
      {
        "b": 1,
        "z": 12,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "TrB"
      },
      {
        "b": 1,
        "z": 12,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "TrBl"
      },
      {
        "b": 1,
        "z": 12,
        "f": "#BDD7EE",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "TrBl"
      },
      {
        "b": 1,
        "z": 12,
        "f": "#F2AAEB",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "TrBl"
      },
      {
        "b": 1,
        "z": 12,
        "f": "#BDD7EE",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "TBl"
      },
      {
        "b": 1,
        "z": 12,
        "f": "#F2AAEB",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "TBl"
      },
      {
        "b": 1,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "TRBl"
      },
      {
        "v": "middle",
        "w": 1
      }
    ],
    "freeze": {
      "x": 0,
      "y": 7
    },
    "rowHeight": 19
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
        "width": 64,
        "s": 0
      },
      {
        "key": "B",
        "label": "VARIETAS",
        "width": 156,
        "s": 0
      },
      {
        "key": "C",
        "label": "Petugas",
        "width": 226,
        "s": 0
      },
      {
        "key": "D",
        "label": "TANGGAL MASUK/KELUAR",
        "width": 193,
        "s": 0,
        "type": "date"
      },
      {
        "key": "E",
        "label": "LOT",
        "width": 124,
        "s": 0
      },
      {
        "key": "F",
        "group": "SS KELUAR/MASUK (Kg)",
        "label": "SS MASUK",
        "width": 95,
        "s": 0
      },
      {
        "key": "G",
        "group": "SS KELUAR/MASUK (Kg)",
        "label": "SS KELUAR",
        "width": 116,
        "s": 0
      },
      {
        "key": "H",
        "label": "STOCK SS",
        "width": 105,
        "s": 0
      },
      {
        "key": "I",
        "label": "KETERANGAN",
        "width": 302,
        "s": 0
      },
      {
        "key": "J",
        "label": "J",
        "width": 93
      },
      {
        "key": "K",
        "label": "PETUGAS",
        "width": 98,
        "s": 1
      },
      {
        "key": "L",
        "label": "KODE PRODUKSI",
        "width": 103,
        "s": 1
      },
      {
        "key": "M",
        "label": "TOTAL BENIH YANG DIBAWA",
        "width": 100,
        "s": 1
      },
      {
        "key": "N",
        "label": "TOTAL YANG TERLAPOR",
        "width": 176,
        "s": 1
      },
      {
        "key": "O",
        "label": "BELUM MASUK LAPORAN",
        "width": 124,
        "s": 1
      },
      {
        "key": "P",
        "label": "KET",
        "width": 185,
        "s": 2
      }
    ],
    "head": {
      "rows": 4,
      "cells": {
        "A1": {
          "t": "BENIH SS MASUK DAN KELUR MTM",
          "s": 3
        },
        "B1": {
          "s": 3
        },
        "C1": {
          "s": 4
        },
        "D1": {
          "s": 4
        },
        "E1": {
          "s": 4
        },
        "F1": {
          "s": 5
        },
        "I1": {
          "s": 6
        },
        "C2": {
          "s": 7
        },
        "D2": {
          "s": 7
        },
        "E2": {
          "s": 7
        },
        "F2": {
          "s": 7
        },
        "K2": {
          "t": "17/11/2025"
        },
        "A3": {
          "t": "NO",
          "s": 8
        },
        "B3": {
          "t": "VARIETAS",
          "s": 8
        },
        "C3": {
          "t": "Petugas",
          "s": 8
        },
        "D3": {
          "t": "TANGGAL MASUK/KELUAR",
          "s": 8
        },
        "E3": {
          "t": "LOT",
          "s": 8
        },
        "F3": {
          "t": "SS KELUAR/MASUK (Kg)",
          "s": 9
        },
        "H3": {
          "t": "STOCK SS",
          "s": 8
        },
        "I3": {
          "t": "KETERANGAN",
          "s": 8
        },
        "K3": {
          "t": "PETUGAS",
          "s": 10
        },
        "L3": {
          "t": "KODE PRODUKSI",
          "s": 10
        },
        "M3": {
          "t": "TOTAL BENIH YANG DIBAWA",
          "s": 11
        },
        "N3": {
          "t": "TOTAL YANG TERLAPOR",
          "s": 10
        },
        "O3": {
          "t": "BELUM MASUK LAPORAN",
          "s": 11
        },
        "P3": {
          "t": "KET",
          "s": 10
        },
        "F4": {
          "t": "SS MASUK",
          "s": 12
        },
        "G4": {
          "t": "SS KELUAR",
          "s": 12
        },
        "K4": {
          "s": 1
        },
        "L4": {
          "s": 1
        },
        "M4": {
          "s": 1
        },
        "N4": {
          "s": 1
        },
        "O4": {
          "s": 1
        },
        "P4": {
          "s": 2
        }
      },
      "heights": {
        "3": 39,
        "4": 21
      },
      "merges": [
        "I1:M1",
        "A3:A4",
        "B3:B4",
        "C3:C4",
        "D3:D4",
        "F3:G3",
        "H3:H4",
        "I3:I4",
        "E3:E4"
      ]
    },
    "styles": [
      {
        "h": "center",
        "bd": "trbl"
      },
      {
        "h": "center",
        "v": "middle",
        "bd": "trbl"
      },
      {
        "bd": "trbl"
      },
      {
        "f": "#FFC000"
      },
      {
        "b": 1,
        "f": "#FFC000"
      },
      {
        "b": 1
      },
      {
        "h": "left"
      },
      {
        "b": 1,
        "h": "center",
        "v": "middle"
      },
      {
        "z": 12,
        "h": "center",
        "v": "middle",
        "bd": "tlrb"
      },
      {
        "z": 12,
        "h": "center",
        "bd": "tlrb"
      },
      {
        "f": "#FF33CC",
        "h": "center",
        "v": "middle",
        "bd": "trbl"
      },
      {
        "f": "#FF33CC",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "trbl"
      },
      {
        "z": 12,
        "h": "center",
        "bd": "trbl"
      }
    ],
    "freeze": {
      "x": 0,
      "y": 4
    },
    "rowHeight": 19
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
        "width": 66,
        "s": 0
      },
      {
        "key": "B",
        "label": "Tanggal masuk",
        "width": 114,
        "s": 0,
        "type": "date"
      },
      {
        "key": "C",
        "label": "Nama petugas",
        "width": 110,
        "hidden": true,
        "s": 0
      },
      {
        "key": "D",
        "label": "Kode Produksi",
        "width": 110,
        "s": 0
      },
      {
        "key": "E",
        "label": "Nama Petani",
        "width": 170,
        "s": 0
      },
      {
        "key": "F",
        "label": "No. Kontrak",
        "width": 97,
        "s": 0
      },
      {
        "key": "G",
        "label": "No Lot",
        "width": 97,
        "s": 0
      },
      {
        "key": "H",
        "label": "Bobot Kotor",
        "width": 106,
        "s": 0
      },
      {
        "key": "I",
        "label": "Bobot Bersih",
        "width": 92,
        "s": 0,
        "formula": "=H{r}"
      },
      {
        "key": "J",
        "label": "Pengiriman",
        "width": 119,
        "s": 0,
        "type": "date"
      },
      {
        "key": "K",
        "label": "Keterangan",
        "width": 266,
        "s": 0
      }
    ],
    "head": {
      "rows": 3,
      "cells": {
        "A1": {
          "t": "BENIH MASUK YLB 2026",
          "s": 1
        },
        "B1": {
          "s": 1
        },
        "C1": {
          "s": 1
        },
        "A3": {
          "t": "NO",
          "s": 2
        },
        "B3": {
          "t": "Tanggal masuk",
          "s": 2
        },
        "C3": {
          "t": "Nama petugas",
          "s": 2
        },
        "D3": {
          "t": "Kode Produksi",
          "s": 2
        },
        "E3": {
          "t": "Nama Petani",
          "s": 2
        },
        "F3": {
          "t": "No. Kontrak",
          "s": 2
        },
        "G3": {
          "t": "No Lot",
          "s": 2
        },
        "H3": {
          "t": "Bobot Kotor",
          "s": 2
        },
        "I3": {
          "t": "Bobot Bersih",
          "s": 2
        },
        "J3": {
          "t": "Pengiriman",
          "s": 2
        },
        "K3": {
          "t": "Keterangan",
          "s": 2
        }
      }
    },
    "styles": [
      {
        "h": "center",
        "bd": "trbl"
      },
      {
        "f": "#FFC000"
      },
      {
        "f": "#FFC000",
        "h": "center",
        "bd": "trbl"
      }
    ],
    "freeze": {
      "x": 9,
      "y": 3
    },
    "rowHeight": 19
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
        "width": 43,
        "s": 0
      },
      {
        "key": "B",
        "label": "PRODUCT",
        "width": 212,
        "s": 0
      },
      {
        "key": "C",
        "label": "KODE PRODUKSI",
        "width": 88,
        "s": 0
      },
      {
        "key": "D",
        "label": "BY",
        "width": 100,
        "s": 0
      },
      {
        "key": "E",
        "label": "Bobot 1000 Butir (gr)",
        "width": 79,
        "s": 0
      },
      {
        "key": "F",
        "label": "TOTAL TARGET (Kg)",
        "width": 66,
        "hidden": true,
        "s": 0,
        "fmt": "_-* #,##0_-;-* #,##0_-;_-* \"-\"_-;_-@_-"
      },
      {
        "key": "G",
        "label": "KETERANGAN",
        "width": 127,
        "s": 0
      },
      {
        "key": "H",
        "group": "StockSeed Tersedia (gr)",
        "label": "Male",
        "width": 86,
        "s": 1,
        "fmt": "_-* #,##0.00_-;-* #,##0.00_-;_-* \"-\"_-;_-@_-",
        "formula": "=SUMIF('Rincian Ketersediaan SS'!C:C,C{r},'Rincian Ketersediaan SS'!J:J)"
      },
      {
        "key": "I",
        "group": "StockSeed Tersedia (gr)",
        "label": "Female",
        "width": 108,
        "s": 1,
        "fmt": "_-* #,##0.00_-;-* #,##0.00_-;_-* \"-\"_-;_-@_-",
        "formula": "=SUMIF('Rincian Ketersediaan SS'!C:C,C{r},'Rincian Ketersediaan SS'!K:K)"
      },
      {
        "key": "J",
        "group": "StockSeed Tersedia (Populasi/Ha)",
        "label": "Male",
        "width": 85,
        "hidden": true,
        "s": 0,
        "fmt": "_-* #,##0_-;-* #,##0_-;_-* \"-\"_-;_-@_-",
        "formula": "=(H{r}*1000)/E{r}"
      },
      {
        "key": "K",
        "group": "StockSeed Tersedia (Populasi/Ha)",
        "label": "Female",
        "width": 91,
        "hidden": true,
        "s": 0,
        "fmt": "_-* #,##0_-;-* #,##0_-;_-* \"-\"_-;_-@_-",
        "formula": "=(I{r}*1000)/E{r}"
      },
      {
        "key": "L",
        "group": "StockSeed Tersedia Setara Target (Kg)",
        "label": "Male",
        "width": 95,
        "hidden": true,
        "s": 0,
        "fmt": "_-* #,##0.00_-;-* #,##0.00_-;_-* \"-\"_-;_-@_-",
        "formula": "=(J{r}*D{r})/1000"
      },
      {
        "key": "M",
        "group": "StockSeed Tersedia Setara Target (Kg)",
        "label": "Female",
        "width": 85,
        "hidden": true,
        "s": 0,
        "fmt": "_-* #,##0.00_-;-* #,##0.00_-;_-* \"-\"_-;_-@_-",
        "formula": "=(K{r}*D{r})/1000"
      },
      {
        "key": "N",
        "group": "Ratio StockSeed",
        "label": "Male",
        "width": 75,
        "hidden": true,
        "s": 0,
        "formula": "=L{r}/L{r}"
      },
      {
        "key": "O",
        "group": "Ratio StockSeed",
        "label": "Female",
        "width": 75,
        "hidden": true,
        "s": 0,
        "formula": "=M{r}/L{r}"
      },
      {
        "key": "P",
        "group": "Progress StockSeed Male (gr)",
        "label": "Progress (gr)",
        "width": 5,
        "hidden": true,
        "s": 0
      },
      {
        "key": "Q",
        "group": "Progress StockSeed Male (gr)",
        "label": "Bulan",
        "width": 5,
        "hidden": true,
        "s": 0
      },
      {
        "key": "R",
        "group": "Progress StockSeed Female (gr)",
        "label": "Progress (gr)",
        "width": 5,
        "hidden": true,
        "s": 0
      },
      {
        "key": "S",
        "group": "Progress StockSeed Female (gr)",
        "label": "Bulan",
        "width": 5,
        "hidden": true,
        "s": 0
      }
    ],
    "head": {
      "rows": 5,
      "cells": {
        "A1": {
          "t": "KETERSEDIAAN STOCK SEED TARGET PRODUKSI TH. 2026",
          "s": 2
        },
        "B1": {
          "s": 2
        },
        "C1": {
          "s": 2
        },
        "D1": {
          "s": 2
        },
        "E1": {
          "s": 2
        },
        "F1": {
          "t": "luas",
          "s": 2
        },
        "G1": {
          "t": "target",
          "s": 2
        },
        "H1": {
          "s": 2
        },
        "I1": {
          "t": "populasi",
          "s": 2
        },
        "J1": {
          "t": "target",
          "s": 2
        },
        "K1": {
          "t": "1000",
          "s": 2
        },
        "L1": {
          "s": 2
        },
        "M1": {
          "t": "target",
          "s": 2
        },
        "N1": {
          "t": "populasi",
          "s": 2
        },
        "O1": {
          "t": "BY",
          "s": 2
        },
        "P1": {
          "s": 2
        },
        "Q1": {
          "s": 2
        },
        "R1": {
          "s": 2
        },
        "S1": {
          "s": 2
        },
        "A2": {
          "t": "PT. BENIH HARAKA SEJAHTERA",
          "s": 2
        },
        "B2": {
          "s": 2
        },
        "C2": {
          "s": 2
        },
        "D2": {
          "s": 2
        },
        "E2": {
          "s": 2
        },
        "F2": {
          "s": 2
        },
        "G2": {
          "t": "BY",
          "s": 2
        },
        "H2": {
          "s": 2
        },
        "I2": {
          "s": 2
        },
        "J2": {
          "t": "BY",
          "s": 2
        },
        "K2": {
          "s": 2
        },
        "L2": {
          "s": 2
        },
        "M2": {
          "s": 2
        },
        "N2": {
          "t": "1000",
          "s": 3
        },
        "P2": {
          "s": 2
        },
        "Q2": {
          "s": 2
        },
        "R2": {
          "s": 2
        },
        "S2": {
          "s": 2
        },
        "A3": {
          "t": "Update :28/09/2026",
          "f": "='Rincian Ketersediaan SS'!$B$1",
          "s": 4
        },
        "B3": {
          "s": 4
        },
        "C3": {
          "s": 2
        },
        "D3": {
          "s": 2
        },
        "E3": {
          "s": 2
        },
        "F3": {
          "s": 2
        },
        "G3": {
          "s": 2
        },
        "H3": {
          "s": 2
        },
        "I3": {
          "s": 2
        },
        "J3": {
          "s": 2
        },
        "K3": {
          "s": 2
        },
        "L3": {
          "s": 2
        },
        "M3": {
          "s": 2
        },
        "N3": {
          "s": 2
        },
        "O3": {
          "s": 2
        },
        "P3": {
          "s": 2
        },
        "Q3": {
          "s": 2
        },
        "R3": {
          "s": 2
        },
        "S3": {
          "s": 2
        },
        "A4": {
          "t": "NO.",
          "s": 5
        },
        "B4": {
          "t": "PRODUCT",
          "s": 5
        },
        "C4": {
          "t": "KODE PRODUKSI",
          "s": 6
        },
        "D4": {
          "t": "BY",
          "s": 6
        },
        "E4": {
          "t": "Bobot 1000 Butir (gr)",
          "s": 6
        },
        "F4": {
          "t": "TOTAL TARGET (Kg)",
          "s": 6
        },
        "G4": {
          "t": "KETERANGAN",
          "s": 5
        },
        "H4": {
          "t": "StockSeed Tersedia (gr)",
          "s": 7
        },
        "J4": {
          "t": "StockSeed Tersedia (Populasi/Ha)",
          "s": 7
        },
        "L4": {
          "t": "StockSeed Tersedia Setara Target (Kg)",
          "s": 7
        },
        "N4": {
          "t": "Ratio StockSeed",
          "s": 8
        },
        "P4": {
          "t": "Progress StockSeed Male (gr)",
          "s": 9
        },
        "R4": {
          "t": "Progress StockSeed Female (gr)",
          "s": 9
        },
        "H5": {
          "t": "Male",
          "s": 10
        },
        "I5": {
          "t": "Female",
          "s": 10
        },
        "J5": {
          "t": "Male",
          "s": 10
        },
        "K5": {
          "t": "Female",
          "s": 10
        },
        "L5": {
          "t": "Male",
          "s": 10
        },
        "M5": {
          "t": "Female",
          "s": 10
        },
        "N5": {
          "t": "Male",
          "s": 10
        },
        "O5": {
          "t": "Female",
          "s": 10
        },
        "P5": {
          "t": "Progress (gr)",
          "s": 11
        },
        "Q5": {
          "t": "Bulan",
          "s": 12
        },
        "R5": {
          "t": "Progress (gr)",
          "s": 11
        },
        "S5": {
          "t": "Bulan",
          "s": 12
        }
      },
      "heights": {
        "4": 47,
        "5": 39
      },
      "merges": [
        "N2:O2",
        "R4:S4",
        "G4:G5",
        "E4:E5",
        "A4:A5",
        "B4:B5",
        "C4:C5",
        "D4:D5",
        "F4:F5",
        "H4:I4",
        "J4:K4",
        "L4:M4",
        "N4:O4",
        "P4:Q4"
      ]
    },
    "styles": [
      {
        "z": 12,
        "bd": "trbl"
      },
      {
        "z": 12,
        "h": "right",
        "bd": "trbl"
      },
      {
        "z": 12
      },
      {
        "z": 12,
        "h": "center"
      },
      {
        "z": 12,
        "f": "#FFFF00"
      },
      {
        "b": 1,
        "z": 12,
        "h": "center",
        "v": "middle",
        "bd": "tlrb"
      },
      {
        "b": 1,
        "z": 12,
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "tlrb"
      },
      {
        "z": 12,
        "f": "#00FFFF",
        "h": "center",
        "w": 1,
        "bd": "tlrb"
      },
      {
        "z": 12,
        "f": "#00FFFF",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "tlrb"
      },
      {
        "z": 12,
        "h": "center",
        "w": 1,
        "bd": "tlrb"
      },
      {
        "z": 12,
        "f": "#00FFFF",
        "bd": "trbl"
      },
      {
        "z": 12,
        "h": "center",
        "w": 1,
        "bd": "trbl"
      },
      {
        "z": 12,
        "h": "center",
        "bd": "trbl"
      }
    ],
    "freeze": {
      "x": 6,
      "y": 5
    },
    "rowHeight": 21
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
        "width": 41,
        "s": 0
      },
      {
        "key": "B",
        "label": "PRODUCT",
        "width": 225,
        "s": 0
      },
      {
        "key": "C",
        "label": "KODE PRODUKSI",
        "width": 116,
        "s": 0
      },
      {
        "key": "D",
        "group": "TANGGAL MASUK",
        "label": "Male",
        "width": 94,
        "s": 0,
        "type": "date"
      },
      {
        "key": "E",
        "group": "TANGGAL MASUK",
        "label": "Female",
        "width": 92,
        "s": 0,
        "type": "date"
      },
      {
        "key": "F",
        "group": "NAMA PETANI",
        "label": "Male",
        "width": 95,
        "s": 0
      },
      {
        "key": "G",
        "group": "NAMA PETANI",
        "label": "Female",
        "width": 190,
        "s": 0
      },
      {
        "key": "H",
        "group": "NO LOT",
        "label": "Male",
        "width": 123,
        "s": 1
      },
      {
        "key": "I",
        "group": "NO LOT",
        "label": "Female",
        "width": 103,
        "s": 2
      },
      {
        "key": "J",
        "group": "Stock Seed Tersedia (gr)",
        "label": "Male",
        "width": 86,
        "s": 2,
        "fmt": "_-* #,##0.00_-;-* #,##0.00_-;_-* \"-\"_-;_-@_-"
      },
      {
        "key": "K",
        "group": "Stock Seed Tersedia (gr)",
        "label": "Female",
        "width": 118,
        "s": 2,
        "fmt": "_-* #,##0.00_-;-* #,##0.00_-;_-* \"-\"_-;_-@_-"
      },
      {
        "key": "L",
        "group": "PENGUJIAN M",
        "label": "Tanggal PCB",
        "width": 98,
        "s": 2,
        "fmt": "_-* #,##0.00_-;-* #,##0.00_-;_-* \"-\"_-;_-@_-",
        "type": "date"
      },
      {
        "key": "M",
        "group": "PENGUJIAN M",
        "label": "TGL LULUS",
        "width": 98,
        "s": 3,
        "type": "date"
      },
      {
        "key": "N",
        "group": "PENGUJIAN M",
        "label": "KA",
        "width": 85,
        "s": 3
      },
      {
        "key": "O",
        "group": "PENGUJIAN M",
        "label": "DB",
        "width": 66,
        "s": 3
      },
      {
        "key": "P",
        "label": "Tanggal PCB",
        "width": 106,
        "s": 3,
        "type": "date"
      },
      {
        "key": "Q",
        "group": "Pengujian F",
        "label": "TGL LULUS",
        "width": 93,
        "s": 3,
        "type": "date"
      },
      {
        "key": "R",
        "label": "KA",
        "width": 64,
        "s": 3
      },
      {
        "key": "S",
        "label": "DB",
        "width": 64,
        "s": 3
      },
      {
        "key": "T",
        "label": "KETERANGAN",
        "width": 494,
        "s": 3
      },
      {
        "key": "U",
        "label": "U",
        "width": 64,
        "s": 4
      },
      {
        "key": "V",
        "group": "Menurut Buku Induk (otomatis per LOT)",
        "width": 110,
        "label": "Masuk Male (gr)",
        "computed": "=IF(H{r}=\"\",\"\",SUMIF('SS Masuk BENIH INTERNAL '!K:K,H{r},'SS Masuk BENIH INTERNAL '!I:I)+SUMIF('SS MASUK NH'!K:K,H{r},'SS MASUK NH'!I:I))",
        "s": 25,
        "fmt": "_-* #,##0.00_-;-* #,##0.00_-;_-* \"-\"_-;_-@_-"
      },
      {
        "key": "W",
        "group": "Menurut Buku Induk (otomatis per LOT)",
        "width": 110,
        "label": "Keluar Male (gr)",
        "computed": "=IF(H{r}=\"\",\"\",SUMIF('SS KELUAR BENIH INTERNAL'!Q:Q,H{r},'SS KELUAR BENIH INTERNAL'!O:O)+SUMIF('SS Keluar NH'!P:P,H{r},'SS Keluar NH'!N:N))",
        "s": 25,
        "fmt": "_-* #,##0.00_-;-* #,##0.00_-;_-* \"-\"_-;_-@_-"
      },
      {
        "key": "X",
        "group": "Menurut Buku Induk (otomatis per LOT)",
        "width": 110,
        "label": "Sisa Male (gr)",
        "computed": "=IF(H{r}=\"\",\"\",V{r}-W{r})",
        "s": 25,
        "fmt": "_-* #,##0.00_-;-* #,##0.00_-;_-* \"-\"_-;_-@_-"
      },
      {
        "key": "Y",
        "group": "Menurut Buku Induk (otomatis per LOT)",
        "width": 110,
        "label": "Masuk Female (gr)",
        "computed": "=IF(I{r}=\"\",\"\",SUMIF('SS Masuk BENIH INTERNAL '!K:K,I{r},'SS Masuk BENIH INTERNAL '!I:I)+SUMIF('SS MASUK NH'!K:K,I{r},'SS MASUK NH'!I:I))",
        "s": 25,
        "fmt": "_-* #,##0.00_-;-* #,##0.00_-;_-* \"-\"_-;_-@_-"
      },
      {
        "key": "Z",
        "group": "Menurut Buku Induk (otomatis per LOT)",
        "width": 110,
        "label": "Keluar Female (gr)",
        "computed": "=IF(I{r}=\"\",\"\",SUMIF('SS KELUAR BENIH INTERNAL'!R:R,I{r},'SS KELUAR BENIH INTERNAL'!P:P)+SUMIF('SS Keluar NH'!Q:Q,I{r},'SS Keluar NH'!O:O))",
        "s": 25,
        "fmt": "_-* #,##0.00_-;-* #,##0.00_-;_-* \"-\"_-;_-@_-"
      },
      {
        "key": "AA",
        "group": "Menurut Buku Induk (otomatis per LOT)",
        "width": 110,
        "label": "Sisa Female (gr)",
        "computed": "=IF(I{r}=\"\",\"\",Y{r}-Z{r})",
        "s": 25,
        "fmt": "_-* #,##0.00_-;-* #,##0.00_-;_-* \"-\"_-;_-@_-"
      }
    ],
    "head": {
      "rows": 3,
      "cells": {
        "B1": {
          "t": "Update :28/09/2026",
          "s": 5
        },
        "C1": {
          "s": 5
        },
        "H1": {
          "s": 6
        },
        "I1": {
          "s": 7
        },
        "A2": {
          "t": "NO.",
          "s": 8
        },
        "B2": {
          "t": "PRODUCT",
          "s": 8
        },
        "C2": {
          "t": "KODE PRODUKSI",
          "s": 9
        },
        "D2": {
          "t": "TANGGAL MASUK",
          "s": 9
        },
        "F2": {
          "t": "NAMA PETANI",
          "s": 9
        },
        "H2": {
          "t": "NO LOT",
          "s": 10
        },
        "J2": {
          "t": "Stock Seed Tersedia (gr)",
          "s": 9
        },
        "L2": {
          "t": "PENGUJIAN M",
          "s": 11
        },
        "P2": {
          "s": 12
        },
        "Q2": {
          "t": "Pengujian F",
          "s": 13
        },
        "R2": {
          "s": 13
        },
        "S2": {
          "s": 14
        },
        "T2": {
          "t": "KETERANGAN",
          "s": 15
        },
        "D3": {
          "t": "Male",
          "s": 16
        },
        "E3": {
          "t": "Female",
          "s": 17
        },
        "F3": {
          "t": "Male",
          "s": 16
        },
        "G3": {
          "t": "Female",
          "s": 17
        },
        "H3": {
          "t": "Male",
          "s": 18
        },
        "I3": {
          "t": "Female",
          "s": 19
        },
        "J3": {
          "t": "Male",
          "s": 16
        },
        "K3": {
          "t": "Female",
          "s": 17
        },
        "L3": {
          "t": "Tanggal PCB",
          "s": 20
        },
        "M3": {
          "t": "TGL LULUS",
          "s": 21
        },
        "N3": {
          "t": "KA",
          "s": 21
        },
        "O3": {
          "t": "DB",
          "s": 21
        },
        "P3": {
          "t": "Tanggal PCB",
          "s": 22
        },
        "Q3": {
          "t": "TGL LULUS",
          "s": 22
        },
        "R3": {
          "t": "KA",
          "s": 22
        },
        "S3": {
          "t": "DB",
          "s": 22
        },
        "T3": {
          "s": 3
        },
        "U3": {
          "s": 23
        },
        "V2": {
          "t": "Menurut Buku Induk (otomatis per LOT)",
          "s": 24
        },
        "W2": {
          "s": 24
        },
        "X2": {
          "s": 24
        },
        "Y2": {
          "s": 24
        },
        "Z2": {
          "s": 24
        },
        "AA2": {
          "s": 24
        },
        "V3": {
          "t": "Masuk Male (gr)",
          "s": 24
        },
        "W3": {
          "t": "Keluar Male (gr)",
          "s": 24
        },
        "X3": {
          "t": "Sisa Male (gr)",
          "s": 24
        },
        "Y3": {
          "t": "Masuk Female (gr)",
          "s": 24
        },
        "Z3": {
          "t": "Keluar Female (gr)",
          "s": 24
        },
        "AA3": {
          "t": "Sisa Female (gr)",
          "s": 24
        }
      },
      "heights": {
        "2": 37,
        "3": 36
      },
      "merges": [
        "A2:A3",
        "B2:B3",
        "C2:C3",
        "J2:K2",
        "L2:O2",
        "H2:I2",
        "D2:E2",
        "F2:G2",
        "V2:AA2"
      ]
    },
    "styles": [
      {
        "z": 12,
        "bd": "trbl"
      },
      {
        "z": 12,
        "h": "left",
        "bd": "trbl"
      },
      {
        "z": 12,
        "h": "right",
        "bd": "trbl"
      },
      {
        "bd": "trbl"
      },
      {
        "z": 12
      },
      {
        "c": "#FF0000"
      },
      {
        "h": "left"
      },
      {
        "h": "right"
      },
      {
        "b": 1,
        "z": 12,
        "h": "center",
        "v": "middle",
        "bd": "tlrb"
      },
      {
        "b": 1,
        "z": 12,
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "tlrb"
      },
      {
        "b": 1,
        "z": 12,
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "tlr"
      },
      {
        "b": 1,
        "f": "#9DC3E6",
        "h": "center",
        "v": "middle",
        "bd": "tlrb"
      },
      {
        "b": 1,
        "f": "#FFCCFF",
        "h": "center",
        "v": "middle",
        "bd": "tb"
      },
      {
        "b": 1,
        "f": "#FFCCFF",
        "v": "middle",
        "bd": "tb"
      },
      {
        "b": 1,
        "f": "#FFCCFF",
        "v": "middle",
        "bd": "trb"
      },
      {
        "b": 1,
        "h": "center",
        "bd": "trbl"
      },
      {
        "b": 1,
        "z": 12,
        "f": "#9DC3E6",
        "bd": "trbl"
      },
      {
        "b": 1,
        "z": 12,
        "f": "#FFCCFF",
        "bd": "trbl"
      },
      {
        "b": 1,
        "z": 12,
        "f": "#9DC3E6",
        "h": "left",
        "bd": "trbl"
      },
      {
        "b": 1,
        "z": 12,
        "f": "#FFCCFF",
        "h": "left",
        "bd": "trbl"
      },
      {
        "b": 1,
        "z": 12,
        "f": "#9DC3E6",
        "v": "middle",
        "bd": "trbl"
      },
      {
        "b": 1,
        "f": "#9DC3E6",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "trbl"
      },
      {
        "b": 1,
        "f": "#FFCCFF",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "trbl"
      },
      {
        "b": 1,
        "h": "center",
        "v": "middle",
        "w": 1
      },
      {
        "b": 1,
        "f": "#DDEBF7",
        "h": "center",
        "v": "center",
        "w": 1,
        "bd": "trbl"
      },
      {
        "f": "#F2F8FD",
        "c": "#1F4E79",
        "bd": "trbl"
      }
    ],
    "freeze": {
      "x": 0,
      "y": 3
    },
    "rowHeight": 19
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
        "width": 64,
        "s": 0
      },
      {
        "key": "B",
        "label": "NAMA PRODUK",
        "width": 217,
        "s": 1
      },
      {
        "key": "C",
        "label": "Kode Produksi",
        "width": 93,
        "s": 1
      },
      {
        "key": "D",
        "label": "M",
        "width": 84,
        "s": 2,
        "formula": "=SUMIF('Rincian Ketersediaan SS'!C:C,C{r},'Rincian Ketersediaan SS'!J:J)"
      },
      {
        "key": "E",
        "label": "F",
        "width": 95,
        "s": 2,
        "formula": "=SUMIF('Rincian Ketersediaan SS'!C:C,C{r},'Rincian Ketersediaan SS'!K:K)"
      }
    ],
    "head": {
      "rows": 1,
      "cells": {
        "A1": {
          "t": "NO",
          "s": 3
        },
        "B1": {
          "t": "NAMA PRODUK",
          "s": 3
        },
        "C1": {
          "t": "Kode Produksi",
          "s": 4
        },
        "D1": {
          "t": "M",
          "s": 4
        },
        "E1": {
          "t": "F",
          "s": 4
        }
      },
      "heights": {
        "1": 39
      }
    },
    "styles": [
      {
        "h": "center",
        "bd": "trbl"
      },
      {
        "z": 12,
        "bd": "trbl"
      },
      {
        "bd": "trbl"
      },
      {
        "b": 1,
        "h": "center",
        "v": "middle",
        "bd": "trbl"
      },
      {
        "b": 1,
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "trbl"
      }
    ],
    "rowHeight": 19
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
        "width": 64,
        "s": 0
      },
      {
        "key": "B",
        "label": "OP/M/F",
        "width": 64,
        "s": 0
      },
      {
        "key": "C",
        "label": "No Batch",
        "width": 64,
        "s": 0
      },
      {
        "key": "D",
        "group": "Uji Pertama",
        "label": "Tgl",
        "width": 78,
        "s": 0,
        "type": "date"
      },
      {
        "key": "E",
        "group": "Uji Pertama",
        "label": "DB",
        "width": 64,
        "s": 0
      },
      {
        "key": "F",
        "group": "Uji Service",
        "label": "Tgl",
        "width": 78,
        "s": 0,
        "type": "date"
      },
      {
        "key": "G",
        "group": "Uji Service",
        "label": "DB",
        "width": 64,
        "s": 0
      },
      {
        "key": "H",
        "group": "Uji Service",
        "label": "Tgl",
        "width": 64,
        "s": 0
      },
      {
        "key": "I",
        "group": "Uji Service",
        "label": "DB",
        "width": 64,
        "s": 0
      },
      {
        "key": "J",
        "group": "Uji Service",
        "label": "Tgl",
        "width": 64,
        "s": 0
      },
      {
        "key": "K",
        "group": "Uji Service",
        "label": "DB",
        "width": 64,
        "s": 0
      }
    ],
    "head": {
      "rows": 4,
      "cells": {
        "A1": {
          "t": "List Uji Servise Benih"
        },
        "A3": {
          "t": "Kode Produksi",
          "s": 1
        },
        "B3": {
          "t": "OP/M/F",
          "s": 2
        },
        "C3": {
          "t": "No Batch",
          "s": 3
        },
        "D3": {
          "t": "Uji Pertama",
          "s": 4
        },
        "F3": {
          "t": "Uji Service",
          "s": 5
        },
        "D4": {
          "t": "Tgl",
          "s": 6
        },
        "E4": {
          "t": "DB",
          "s": 6
        },
        "F4": {
          "t": "Tgl",
          "s": 6
        },
        "G4": {
          "t": "DB",
          "s": 6
        },
        "H4": {
          "t": "Tgl",
          "s": 6
        },
        "I4": {
          "t": "DB",
          "s": 6
        },
        "J4": {
          "t": "Tgl",
          "s": 6
        },
        "K4": {
          "t": "DB",
          "s": 7
        }
      },
      "heights": {
        "2": 20,
        "3": 39,
        "4": 20
      },
      "merges": [
        "D3:E3",
        "F3:K3",
        "A3:A4",
        "C3:C4",
        "B3:B4"
      ]
    },
    "styles": [
      {
        "bd": "trbl"
      },
      {
        "b": 1,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "TLrB"
      },
      {
        "b": 1,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "TlrB"
      },
      {
        "b": 1,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "bd": "TlrB"
      },
      {
        "b": 1,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "bd": "Tlrb"
      },
      {
        "b": 1,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "bd": "TlRb"
      },
      {
        "b": 1,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "bd": "trBl"
      },
      {
        "b": 1,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "bd": "tRBl"
      }
    ],
    "rowHeight": 19
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
        "width": 64,
        "s": 0
      },
      {
        "key": "B",
        "label": "OP/M/F",
        "width": 64,
        "s": 0
      },
      {
        "key": "C",
        "label": "LOT",
        "width": 64,
        "s": 0
      },
      {
        "key": "D",
        "label": "gr",
        "width": 64,
        "s": 0
      },
      {
        "key": "E",
        "label": "Tgl PCB",
        "width": 79,
        "s": 1,
        "type": "date"
      },
      {
        "key": "F",
        "group": "Uji Service",
        "label": "Tgl",
        "width": 78,
        "s": 2,
        "type": "date"
      },
      {
        "key": "G",
        "group": "Uji Service",
        "label": "DB",
        "width": 64,
        "s": 2
      },
      {
        "key": "H",
        "group": "Uji Service",
        "label": "Tgl",
        "width": 64,
        "s": 2
      },
      {
        "key": "I",
        "group": "Uji Service",
        "label": "DB",
        "width": 64,
        "s": 2
      },
      {
        "key": "J",
        "group": "Uji Service",
        "label": "Tgl",
        "width": 64,
        "s": 2
      },
      {
        "key": "K",
        "group": "Uji Service",
        "label": "DB",
        "width": 64,
        "s": 2
      }
    ],
    "head": {
      "rows": 4,
      "cells": {
        "A1": {
          "t": "List Uji Servise Benih"
        },
        "A3": {
          "t": "Kode Produksi",
          "s": 3
        },
        "B3": {
          "t": "OP/M/F",
          "s": 4
        },
        "C3": {
          "t": "LOT",
          "s": 5
        },
        "D3": {
          "t": "gr",
          "s": 5
        },
        "E3": {
          "t": "Tgl PCB",
          "s": 6
        },
        "F3": {
          "t": "Uji Service",
          "s": 7
        },
        "F4": {
          "t": "Tgl",
          "s": 8
        },
        "G4": {
          "t": "DB",
          "s": 8
        },
        "H4": {
          "t": "Tgl",
          "s": 9
        },
        "I4": {
          "t": "DB",
          "s": 9
        },
        "J4": {
          "t": "Tgl",
          "s": 9
        },
        "K4": {
          "t": "DB",
          "s": 10
        }
      },
      "heights": {
        "2": 20,
        "3": 39,
        "4": 20
      },
      "merges": [
        "A3:A4",
        "B3:B4",
        "C3:C4",
        "F3:K3",
        "D3:D4",
        "E3:E4"
      ]
    },
    "styles": [
      {
        "h": "center",
        "bd": "trbl"
      },
      {
        "bd": "rbl"
      },
      {
        "bd": "trbl"
      },
      {
        "b": 1,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "TLr"
      },
      {
        "b": 1,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "Tlr"
      },
      {
        "b": 1,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "bd": "Tlr"
      },
      {
        "b": 1,
        "f": "#ED7D31",
        "h": "center",
        "v": "middle",
        "bd": "TlrB"
      },
      {
        "b": 1,
        "f": "#FFFF00",
        "h": "center",
        "v": "middle",
        "bd": "TlRb"
      },
      {
        "b": 1,
        "f": "#ED7D31",
        "h": "center",
        "v": "middle",
        "bd": "trBl"
      },
      {
        "b": 1,
        "h": "center",
        "v": "middle",
        "bd": "trBl"
      },
      {
        "b": 1,
        "h": "center",
        "v": "middle",
        "bd": "tRBl"
      }
    ],
    "rowHeight": 19
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
        "width": 101,
        "s": 0
      },
      {
        "key": "B",
        "label": "Nama Produk",
        "width": 101,
        "s": 0
      },
      {
        "key": "C",
        "label": "Male",
        "width": 101,
        "s": 1
      },
      {
        "key": "D",
        "label": "Female",
        "width": 101,
        "s": 1
      },
      {
        "key": "E",
        "label": "E",
        "width": 64
      },
      {
        "key": "F",
        "label": "F",
        "width": 64
      },
      {
        "key": "G",
        "label": "G",
        "width": 64
      },
      {
        "key": "H",
        "label": "H",
        "width": 64
      }
    ],
    "head": {
      "rows": 1,
      "cells": {
        "A1": {
          "t": "Kode Produksi",
          "s": 2
        },
        "B1": {
          "t": "Nama Produk",
          "s": 2
        },
        "C1": {
          "t": "Male",
          "s": 2
        },
        "D1": {
          "t": "Female",
          "s": 2
        }
      }
    },
    "styles": [
      {
        "h": "left"
      },
      {
        "h": "center"
      },
      {
        "b": 1,
        "h": "center",
        "v": "middle"
      }
    ],
    "rowHeight": 19
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
        "width": 64,
        "s": 0
      },
      {
        "key": "B",
        "label": "Kode Produksi",
        "width": 104,
        "s": 1
      },
      {
        "key": "C",
        "group": "BS Tersedia (gr)",
        "label": "M",
        "width": 64,
        "s": 1
      },
      {
        "key": "D",
        "group": "BS Tersedia (gr)",
        "label": "F",
        "width": 64,
        "s": 1
      }
    ],
    "head": {
      "rows": 4,
      "cells": {
        "B1": {
          "t": "Bobot BS"
        },
        "A3": {
          "t": "No",
          "s": 2
        },
        "B3": {
          "t": "Kode Produksi",
          "s": 3
        },
        "C3": {
          "t": "BS Tersedia (gr)",
          "s": 4
        },
        "C4": {
          "t": "M",
          "s": 5
        },
        "D4": {
          "t": "F",
          "s": 5
        }
      },
      "merges": [
        "C3:D3",
        "B3:B4",
        "A3:A4"
      ]
    },
    "styles": [
      {
        "h": "center",
        "v": "middle",
        "bd": "trbl"
      },
      {
        "v": "middle",
        "bd": "trbl"
      },
      {
        "h": "center",
        "v": "middle",
        "bd": "tlrb"
      },
      {
        "h": "left",
        "v": "middle",
        "bd": "tlrb"
      },
      {
        "h": "center",
        "bd": "tlrb"
      },
      {
        "h": "center",
        "bd": "trbl"
      }
    ],
    "rowHeight": 19,
    "hiddenInExcel": true
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
        "width": 69,
        "s": 0
      },
      {
        "key": "B",
        "label": "Target (kg)",
        "width": 60,
        "s": 1
      },
      {
        "key": "C",
        "label": "BY (gr)",
        "width": 55,
        "s": 1
      },
      {
        "key": "D",
        "label": "Pop Prod (tanaman)",
        "width": 81,
        "s": 2,
        "fmt": "_-* #,##0_-;-* #,##0_-;_-* \"-\"_-;_-@_-",
        "formula": "=B{r}/C{r}*1000"
      },
      {
        "key": "E",
        "label": "Pop yang ditanam Prod (tanaman)",
        "width": 112,
        "s": 1,
        "fmt": "_-* #,##0_-;-* #,##0_-;_-* \"-\"_-;_-@_-"
      },
      {
        "key": "F",
        "label": "Bobot 1000 butir (gr)",
        "width": 80,
        "s": 1,
        "fmt": "_-* #,##0.0_-;-* #,##0.0_-;_-* \"-\"_-;_-@_-"
      },
      {
        "key": "G",
        "label": "Kebutuhan SS (gr)",
        "width": 81,
        "s": 2,
        "formula": "=E{r}*F{r}/1000"
      },
      {
        "key": "H",
        "label": "Pop RD (tanaman)",
        "width": 81,
        "s": 2,
        "fmt": "0.0",
        "formula": "=G{r}/C{r}"
      },
      {
        "key": "I",
        "label": "Pop yang ditanam RD (tanaman)",
        "width": 106,
        "s": 1
      },
      {
        "key": "J",
        "label": "Ket",
        "width": 64,
        "s": 1
      }
    ],
    "head": {
      "rows": 2,
      "cells": {
        "A1": {
          "t": "PLAN PERBANYAKAN SS TAHUN 2023",
          "s": 3
        },
        "A2": {
          "t": "Kode Produksi",
          "s": 4
        },
        "B2": {
          "t": "Target (kg)",
          "s": 5
        },
        "C2": {
          "t": "BY (gr)",
          "s": 5
        },
        "D2": {
          "t": "Pop Prod (tanaman)",
          "s": 5
        },
        "E2": {
          "t": "Pop yang ditanam Prod (tanaman)",
          "s": 5
        },
        "F2": {
          "t": "Bobot 1000 butir (gr)",
          "s": 5
        },
        "G2": {
          "t": "Kebutuhan SS (gr)",
          "s": 5
        },
        "H2": {
          "t": "Pop RD (tanaman)",
          "s": 5
        },
        "I2": {
          "t": "Pop yang ditanam RD (tanaman)",
          "s": 5
        },
        "J2": {
          "t": "Ket",
          "s": 6
        }
      },
      "heights": {
        "1": 20,
        "2": 59
      },
      "merges": [
        "A1:J1"
      ]
    },
    "styles": [
      {
        "h": "center",
        "v": "middle",
        "bd": "trbl"
      },
      {
        "bd": "trbl"
      },
      {
        "bd": "rbl"
      },
      {
        "b": 1,
        "h": "center",
        "bd": "B"
      },
      {
        "f": "#FFC000",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "TrBL"
      },
      {
        "f": "#FFC000",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "TrBl"
      },
      {
        "f": "#FFC000",
        "h": "center",
        "v": "middle",
        "w": 1,
        "bd": "TRBl"
      }
    ],
    "freeze": {
      "x": 0,
      "y": 2
    },
    "rowHeight": 19,
    "hiddenInExcel": true
  }
];
