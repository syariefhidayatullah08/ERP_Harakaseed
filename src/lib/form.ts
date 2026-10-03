export const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
export const numf = (fd: FormData, key: string) => {
  const v = Number(String(fd.get(key) ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(v) ? v : 0;
};
export const withMsg = (path: string, msg: string, kind: "msg" | "error" = "msg") =>
  `${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}`;

/** ID dari URL: hanya angka positif; selain itu -1 (tidak akan cocok dengan baris mana pun → 404). */
export const toId = (s: string) => (/^[1-9]\d{0,9}$/.test(s) ? Number(s) : -1);
