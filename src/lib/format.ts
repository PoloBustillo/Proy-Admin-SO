import type { Language, Submission } from "@/lib/types";

export type Outcome = "queued" | "running" | "ok" | "error";

export function outcome(job: Submission): Outcome {
  if (job.status === "queued") return "queued";
  if (job.status === "running") return "running";
  return job.exitCode === 0 ? "ok" : "error";
}

export function outcomeLabel(kind: Outcome) {
  if (kind === "queued") return "En cola";
  if (kind === "running") return "Ejecutando";
  if (kind === "ok") return "Listo";
  return "Error";
}

export function languageLabel(language: Language) {
  if (language === "cpp") return "C++";
  if (language === "python") return "Python";
  if (language === "java") return "Java";
  return "C";
}

const whenFormat = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

export function formatWhen(iso: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return whenFormat.format(date);
}
