import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadFile(name: string) {
  const full = path.join(process.cwd(), name);
  if (!existsSync(full)) return;
  for (const line of readFileSync(full, "utf8").split("\n")) {
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
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/** Carga .env y después .env.local. No pisa variables que ya existan. */
export function loadEnvFiles() {
  loadFile(".env");
  loadFile(".env.local");
}
