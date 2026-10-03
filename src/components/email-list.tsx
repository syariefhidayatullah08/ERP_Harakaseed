import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { tanggal } from "@/lib/format";
import { Badge, Empty } from "./ui";

export type EmailRow = {
  id: number;
  direction: string;
  from_addr: string;
  to_addr: string;
  subject: string;
  status: string;
  error: string;
  is_read: number;
  created_at: string;
};

export function EmailList({ rows, empty = "Belum ada email." }: { rows: EmailRow[]; empty?: string }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <ul className="divide-y divide-line">
      {rows.map((m) => {
        const inbound = m.direction === "in";
        return (
          <li key={m.id}>
            <Link href={`/email/${m.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-brand-50/50">
              <span className={`mt-0.5 rounded-full p-1 ${inbound ? "bg-sky-50 text-sky-700" : "bg-brand-50 text-brand-700"}`}>
                {inbound ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className={`truncate text-sm ${inbound && !m.is_read ? "font-bold" : "font-medium"}`}>{m.subject}</span>
                  <span className="shrink-0 text-xs text-muted">{tanggal(m.created_at)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="truncate">{inbound ? `Dari ${m.from_addr}` : `Ke ${m.to_addr}`}</span>
                  {m.status === "gagal" && (
                    <span title={m.error}>
                      <Badge tone="red">Gagal</Badge>
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
