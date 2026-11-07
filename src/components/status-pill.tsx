import type { Outcome } from "@/lib/format";
import { outcomeLabel } from "@/lib/format";

export function StatusPill({ kind, code }: { kind: Outcome; code: number | null }) {
  const suffix = kind === "ok" || kind === "error" ? ` · ${code ?? "?"}` : "";
  return (
    <span className={`pill pill-${kind}`}>
      {outcomeLabel(kind)}
      {suffix}
    </span>
  );
}
