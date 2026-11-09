import { processQueue } from "@/app/actions";
import { PlayButton } from "@/components/play-button";

export function ProcessForm({
  returnTo,
  submissionId,
  label = "Correr lo que ya está en tiempo",
}: {
  returnTo: string;
  submissionId?: string;
  label?: string;
}) {
  return (
    <form action={processQueue} className="flex items-center gap-3">
      <input type="hidden" name="returnTo" value={returnTo} />
      {submissionId ? <input type="hidden" name="submissionId" value={submissionId} /> : null}
      <PlayButton label={label} />
    </form>
  );
}
