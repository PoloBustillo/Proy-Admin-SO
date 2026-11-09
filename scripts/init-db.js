const fs = require("node:fs");
const path = require("node:path");
const pg = require("pg");

const root = path.join(__dirname, "..");

function loadEnvFile(name, override) {
  const full = path.join(root, name);
  if (!fs.existsSync(full)) return;
  for (const line of fs.readFileSync(full, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (override || process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env", false);
loadEnvFile(".env.local", true);

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
  run_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz
);

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS run_at timestamptz;
UPDATE submissions SET run_at = created_at WHERE run_at IS NULL;

CREATE INDEX IF NOT EXISTS submissions_user_created
  ON submissions (user_id, created_at DESC);
`;

function databaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("Falta DATABASE_URL.");
  return new URL(value);
}

function databaseName(url) {
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
    if ((existing.rowCount || 0) === 0) {
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

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("password authentication failed")) {
    let user = "postgres";
    let host = "127.0.0.1:5432";
    try {
      const url = new URL(process.env.DATABASE_URL || "");
      user = decodeURIComponent(url.username || user);
      host = `${url.hostname || "127.0.0.1"}:${url.port || "5432"}`;
    } catch {
      /* The URL is already invalid; the message below is enough. */
    }
    console.error(`La clave no coincide para el usuario "${user}" en ${host}.`);
    console.error("Prueba la misma URL con: psql \"$DATABASE_URL\" -c 'SELECT current_user;'");
    console.error("Si falla, pon la clave de nuevo: sudo -u postgres psql -c \"ALTER USER postgres PASSWORD 'una_clave';\"");
    process.exit(1);
  }
  console.error(message);
  process.exit(1);
});
