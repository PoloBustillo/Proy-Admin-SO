import pg from "pg";
import { loadEnvFiles } from "./load-env";

loadEnvFiles();

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL,
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY,
  user_id text NOT NULL REFERENCES users (id),
  language text NOT NULL,
  filename text NOT NULL,
  source text NOT NULL,
  stdin text NOT NULL DEFAULT '',
  status text NOT NULL,
  exit_code integer,
  stdout text NOT NULL DEFAULT '',
  stderr text NOT NULL DEFAULT '',
  command text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL,
  started_at timestamptz,
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS submissions_user_created
  ON submissions (user_id, created_at DESC);
`;

function databaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("Falta DATABASE_URL.");
  return new URL(value);
}

function databaseName(url: URL) {
  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error("El nombre de la base solo puede tener letras, números y _.");
  }
  return name;
}

async function main() {
  const url = databaseUrl();
  const name = databaseName(url);
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";

  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if ((existing.rowCount ?? 0) === 0) {
      await admin.query(`CREATE DATABASE ${name}`);
      console.log(`Base ${name} creada.`);
    } else {
      console.log(`Base ${name} ya existe.`);
    }
  } finally {
    await admin.end();
  }

  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    await client.query(SCHEMA);
  } finally {
    await client.end();
  }
  console.log("Tablas users y submissions listas.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
