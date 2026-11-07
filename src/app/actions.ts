"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { insertSubmission, listByUser, upsertUser } from "@/lib/db";
import { safeFilename } from "@/lib/filenames";
import { runQueue } from "@/lib/queue";
import { getSession } from "@/lib/session";
import { putPendingJob } from "@/lib/storage";
import { isLanguage, type Submission } from "@/lib/types";

export type ActionError = { error: string } | null;

const MAX_SOURCE = 200_000;
const MAX_STDIN = 20_000;
const MAX_PENDING = 30;

function safeReturn(value: FormDataEntryValue | null) {
  const text = String(value || "/dashboard").split("?")[0];
  if (!/^\/[A-Za-z0-9/_-]*$/.test(text)) return "/dashboard";
  return text;
}

export async function devLogin(formData: FormData) {
  if (process.env.AUTH_DEV_LOGIN !== "true") redirect("/login?error=dev");

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  if (email.length > 120 || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/login?error=correo");
  }

  const session = await getSession();
  session.userId = `dev:${email}`;
  session.email = email;
  session.name = name || email;
  delete session.image;
  await session.save();
  await upsertUser(session.userId, session.email, session.name);
  redirect("/dashboard");
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
  await getCurrentUser();
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
