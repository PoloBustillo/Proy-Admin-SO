import pg from "pg";
import { isLanguage, type Submission } from "@/lib/types";

let pool: pg.Pool | null = null;

/** Una sola conexión a Postgres. DATABASE_URL es local, en 127.0.0.1. */
function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("Falta DATABASE_URL.");
    pool = new pg.Pool({ connectionString });
  }
  return pool;
}

type SubmissionRow = {
  id: string;
  user_id: string;
  language: string;
  filename: string;
  source: string;
  exit_code: number | null;
  stdout: string;
  stderr: string;
  command: string;
  created_at: Date;
  finished_at: Date | null;
};

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function mapRow(row: SubmissionRow): Submission {
  if (!isLanguage(row.language)) throw new Error("Lenguaje desconocido en la base.");
  return {
    id: row.id,
    userId: row.user_id,
    language: row.language,
    filename: row.filename,
    source: row.source,
    exitCode: row.exit_code,
    stdout: row.stdout,
    stderr: row.stderr,
    command: row.command,
    createdAt: row.created_at.toISOString(),
    finishedAt: toIso(row.finished_at),
  };
}

const SELECT_SUBMISSION = `
  SELECT id, user_id, language, filename, source,
         exit_code, stdout, stderr, command, created_at, finished_at
  FROM submissions
`;

/** Crea el usuario al entrar con Google, o actualiza su nombre y correo. */
export async function upsertUser(id: string, email: string, name: string) {
  await getPool().query(
    `INSERT INTO users (id, email, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name`,
    [id, email, name],
  );
}

/** Guarda el programa y el resultado de haberlo corrido en este servidor. */
export async function insertSubmission(submission: Submission) {
  await getPool().query(
    `INSERT INTO submissions (
       id, user_id, language, filename, source, status,
       exit_code, stdout, stderr, command, created_at, finished_at
     ) VALUES (
       $1, $2, $3, $4, $5, 'finished',
       $6, $7, $8, $9, $10, $11
     )`,
    [
      submission.id,
      submission.userId,
      submission.language,
      submission.filename,
      submission.source,
      submission.exitCode,
      submission.stdout,
      submission.stderr,
      submission.command,
      submission.createdAt,
      submission.finishedAt,
    ],
  );
}

/** Historial de una persona, de la más nueva a la más vieja. */
export async function listByUser(userId: string) {
  const result = await getPool().query<SubmissionRow>(
    `${SELECT_SUBMISSION} WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return result.rows.map(mapRow);
}

/** Borra una ejecución solo si la fila es de ese usuario. */
export async function deleteOwned(id: string, userId: string) {
  const result = await getPool().query(`DELETE FROM submissions WHERE id = $1 AND user_id = $2`, [id, userId]);
  return (result.rowCount ?? 0) > 0;
}

/** Una ejecución, solo si pertenece a ese usuario. */
export async function getOwned(id: string, userId: string) {
  const result = await getPool().query<SubmissionRow>(
    `${SELECT_SUBMISSION} WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}
