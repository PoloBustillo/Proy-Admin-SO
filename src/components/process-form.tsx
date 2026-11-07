import { processQueue } from "@/app/actions";
import { PendingButton } from "@/components/pending-button";

export function ProcessForm({ returnTo }: { returnTo: string }) {
  return (
    <form action={processQueue}>
      <input type="hidden" name="returnTo" value={returnTo} />
      <PendingButton pendingLabel="Procesando…">Procesar cola ahora</PendingButton>
    </form>
  );
}
