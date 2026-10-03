import { composeEmail } from "@/actions/email";
import { SubmitButton } from "./buttons";
import { Field } from "./ui";

export function EmailCompose({
  to = "",
  subject = "",
  message = "",
  back,
  refType,
  refId,
}: {
  to?: string;
  subject?: string;
  message?: string;
  back: string;
  refType?: string;
  refId?: number;
}) {
  return (
    <form action={composeEmail} className="space-y-3 p-5">
      <input type="hidden" name="back" value={back} />
      {refType && <input type="hidden" name="ref_type" value={refType} />}
      {refId && <input type="hidden" name="ref_id" value={refId} />}
      <Field label="Kepada">
        <input name="to" type="email" required list="customer-emails" defaultValue={to} className="input" placeholder="nama@contoh.com" />
      </Field>
      <Field label="Subjek">
        <input name="subject" required defaultValue={subject} className="input" />
      </Field>
      <Field label="Pesan">
        <textarea name="message" required rows={6} defaultValue={message} className="input" />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pendingText="Mengirim…">Kirim email</SubmitButton>
      </div>
    </form>
  );
}
