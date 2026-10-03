export const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
export const numf = (fd: FormData, key: string) => {
  const v = Number(String(fd.get(key) ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(v) ? v : 0;
};
export const withMsg = (path: string, msg: string, kind: "msg" | "error" = "msg") =>
  `${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}`;
