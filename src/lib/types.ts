export const LANGUAGES = ["python", "java", "c", "cpp"] as const;

export type Language = (typeof LANGUAGES)[number];

export type SubmissionStatus = "queued" | "running" | "finished";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  image?: string;
};

export type Submission = {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  language: Language;
  filename: string;
  source: string;
  stdin: string;
  status: SubmissionStatus;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  command: string;
  createdAt: string;
  runAt: string;
  scheduled: boolean;
  startedAt: string | null;
  finishedAt: string | null;
};

export type JobResult = {
  id: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  command: string;
  startedAt: string;
  finishedAt: string;
};

const LANGUAGE_SET: ReadonlySet<string> = new Set(LANGUAGES);

/** Comprueba que el lenguaje sea python, java, c o cpp. */
export function isLanguage(value: string): value is Language {
  return LANGUAGE_SET.has(value);
}

const ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El id de un trabajo es un UUID. Sirve para no armar rutas raras en el FTP. */
export function isJobId(value: string) {
  return ID_PATTERN.test(value);
}
