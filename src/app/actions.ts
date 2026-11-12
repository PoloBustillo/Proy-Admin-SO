"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { deleteOwned, insertSubmission } from "@/lib/db";
import { filenameFor } from "@/lib/filenames";
import { executeJob } from "@/lib/runner";
import { getSession } from "@/lib/session";
import { isJobId, isLanguage, type Submission } from "@/lib/types";

export type ActionError = { error: string } | null;

const MAX_SOURCE = 200_000;

/** Cierra la cookie y vuelve al inicio. */
export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/");
}

/** Corre el programa en este servidor y guarda la salida en PostgreSQL. */
export async function submitCode(_prev: ActionError, formData: FormData): Promise<ActionError> {
  const user = await getCurrentUser();
  const languageValue = String(formData.get("language") || "");
  if (!isLanguage(languageValue)) return { error: "Elige Python, Java, C o C++." };

  const source = String(formData.get("source") || "");
  const id = randomUUID();
  const filename = filenameFor(languageValue, source, String(formData.get("filename") || ""));

  if (!source) return { error: "Escribe o carga un programa." };
  if (source.includes("\0")) return { error: "El archivo no es texto." };
  if (source.length > MAX_SOURCE) return { error: "El programa supera 200 KB." };
  let result;
  try {
    result = await executeJob({ id, language: languageValue, filename, source });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo correr el programa.";
    return { error: message };
  }

  const submission: Submission = {
    id,
    userId: user.id,
    language: languageValue,
    filename,
    source,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    command: result.command,
    createdAt: result.startedAt,
    finishedAt: result.finishedAt,
  };

  await insertSubmission(submission);
  redirect(`/ejecuciones/${submission.id}`);
}

/** Borra la fila del usuario. */
export async function deleteSubmission(formData: FormData) {
  const user = await getCurrentUser();
  const id = String(formData.get("id") || "");
  if (!isJobId(id)) redirect("/historial");
  await deleteOwned(id, user.id);
  redirect("/historial");
}
