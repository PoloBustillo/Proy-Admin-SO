"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { insertSubmission, listByUser, runOwnJobNow } from "@/lib/db";
import { safeFilename } from "@/lib/filenames";
import { runQueue } from "@/lib/queue";
import { getSession } from "@/lib/session";
import { putPendingJob } from "@/lib/storage";
import { isJobId, isLanguage, type Submission } from "@/lib/types";

export type ActionError = { error: string } | null;

const MAX_SOURCE = 200_000;
const MAX_STDIN = 20_000;
const MAX_PENDING = 30;

function parseRunAt(value: string): { iso: string } | { error: string } {
  if (!value) return { iso: new Date().toISOString() };
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return { error: "La hora de ejecución no es válida." };
  }
  const date = new Date(`${value}:00-06:00`);
  if (Number.isNaN(date.getTime())) return { error: "La hora de ejecución no es válida." };
  const now = Date.now();
  if (date.getTime() < now - 60_000) return { iso: new Date(now).toISOString() };
  if (date.getTime() > now + 7 * 24 * 60 * 60 * 1000) {
    return { error: "Solo puedes programar hasta 7 días adelante." };
  }
  return { iso: date.toISOString() };
}

function safeReturn(value: FormDataEntryValue | null) {
  const text = String(value || "/dashboard").split("?")[0];
  if (!/^\/[A-Za-z0-9/_-]*$/.test(text)) return "/dashboard";
  return text;
}

export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/");
}

export async function submitCode(_prev: ActionError, formData: FormData): Promise<ActionError> {
  const user = await getCurrentUser();
  const languageValue = String(formData.get("language") || "");
  if (!isLanguage(languageValue)) return { error: "Elige Python, Java, C o C++." };

  const source = String(formData.get("source") || "");
  const stdin = String(formData.get("stdin") || "");
  const filename = safeFilename(String(formData.get("filename") || ""), languageValue);

  if (!source) return { error: "Escribe o carga un programa." };
  if (source.includes("\0")) return { error: "El archivo no es texto." };
  if (source.length > MAX_SOURCE) return { error: "El programa supera 200 KB." };
  if (stdin.length > MAX_STDIN) return { error: "La entrada estándar supera 20 KB." };

  const pending = (await listByUser(user.id)).filter((job) => job.status !== "finished");
  if (pending.length >= MAX_PENDING) {
    return { error: "Tienes 30 trabajos sin terminar. Espera a que corra la cola." };
  }

  const runAt = parseRunAt(String(formData.get("runAt") || ""));
  if ("error" in runAt) return { error: runAt.error };

  const submission: Submission = {
    id: randomUUID(),
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    language: languageValue,
    filename,
    source,
    stdin,
    status: "queued",
    exitCode: null,
    stdout: "",
    stderr: "",
    command: "",
    createdAt: new Date().toISOString(),
    runAt: runAt.iso,
    startedAt: null,
    finishedAt: null,
  };

  try {
    await putPendingJob(
      {
        id: submission.id,
        language: submission.language,
        filename: submission.filename,
        stdin: submission.stdin,
        createdAt: submission.createdAt,
      },
      submission.source,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar el archivo.";
    return { error: message };
  }

  await insertSubmission(submission);
  redirect(`/ejecuciones/${submission.id}`);
}

export async function processQueue(formData: FormData) {
  const user = await getCurrentUser();
  const submissionId = String(formData.get("submissionId") || "");
  if (submissionId && isJobId(submissionId)) {
    await runOwnJobNow(submissionId, user.id);
  }
  const returnTo = safeReturn(formData.get("returnTo"));

  try {
    await runQueue(5);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo procesar la cola.";
    const params = new URLSearchParams({ aviso: message.slice(0, 180) });
    redirect(`${returnTo}?${params.toString()}`);
  }

  redirect(returnTo);
}
