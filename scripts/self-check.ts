import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { safeFilename } from "../src/lib/filenames";
import { loadEnvFiles } from "./load-env";

async function main() {
  loadEnvFiles();
  const dir = await mkdtemp(path.join(os.tmpdir(), "nucleo-check-"));
  process.env.NUCLEO_DATA_DIR = dir;
  process.env.STORAGE_DRIVER = "local";
  process.env.RUN_TIMEOUT_SEC = "8";

  const { executeJob } = await import("../src/lib/runner");
  const { saveSource } = await import("../src/lib/storage");
  const { runQueue } = await import("../src/lib/queue");
  const { insertSubmission, getOwned, listByUser } = await import("../src/lib/db");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function hasCommand(command: string) {
  return spawnSync("which", [command], { encoding: "utf8" }).status === 0;
}

const passwd = safeFilename("../../etc/passwd", "python");
assert(passwd === "passwd.py", `nombre inesperado: ${passwd}`);
assert(!safeFilename("-n.java", "java").startsWith("-"), "el nombre no debe parecer un flag");
assert(safeFilename("", "c") === "main.c", "faltó el nombre por defecto de C");
assert(safeFilename("Hola.java", "java") === "Hola.java", "se cambió un nombre Java válido");

if (!hasCommand("python3")) {
  throw new Error("python3 no está instalado.");
}

const hello = await executeJob({
  id: "11111111-1111-4111-8111-111111111111",
  language: "python",
  filename: "hola.py",
  source: 'print("  hola")\n',
  stdin: "",
});
assert(hello.exitCode === 0, `python falló: ${hello.stderr}`);
assert(hello.stdout === "  hola\n", `stdout inesperado: ${JSON.stringify(hello.stdout)}`);

const stdinJob = await executeJob({
  id: "22222222-2222-4222-8222-222222222222",
  language: "python",
  filename: "eco.py",
  source: "import sys\nprint(sys.stdin.read().strip())\n",
  stdin: "abc\n",
});
assert(stdinJob.exitCode === 0 && stdinJob.stdout.trim() === "abc", `stdin falló: ${stdinJob.stderr}`);

const broken = await executeJob({
  id: "33333333-3333-4333-8333-333333333333",
  language: "python",
  filename: "mal.py",
  source: "print(\n",
  stdin: "",
});
assert(broken.exitCode !== 0 && broken.stderr.length > 0, "un error de Python no produjo stderr");

process.env.RUN_TIMEOUT_SEC = "1";
const slow = await executeJob({
  id: "44444444-4444-4444-8444-444444444444",
  language: "python",
  filename: "lento.py",
  source: "import time\ntime.sleep(30)\n",
  stdin: "",
});
process.env.RUN_TIMEOUT_SEC = "8";
assert(slow.exitCode === 124, `el tiempo límite no cortó el proceso (código ${slow.exitCode})`);

if (hasCommand("cc")) {
  const cjob = await executeJob({
    id: "55555555-5555-4555-8555-555555555555",
    language: "c",
    filename: "hola.c",
    source: '#include <stdio.h>\nint main(void){printf("c-ok\\n");return 0;}\n',
    stdin: "",
  });
  assert(cjob.exitCode === 0 && cjob.stdout.includes("c-ok"), `C falló: ${cjob.stderr}`);

  const badC = await executeJob({
    id: "66666666-6666-4666-8666-666666666666",
    language: "c",
    filename: "mal.c",
    source: "int main( {\n",
    stdin: "",
  });
  assert(badC.exitCode !== 0 && badC.stderr.length > 0, "un error de C no produjo stderr");
} else {
  console.log("cc no está instalado; se omite C.");
}

if (hasCommand("c++")) {
  const cpp = await executeJob({
    id: "77777777-7777-4777-8777-777777777777",
    language: "cpp",
    filename: "hola.cpp",
    source: '#include <iostream>\nint main(){std::cout<<"cpp-ok\\n";return 0;}\n',
    stdin: "",
  });
  assert(cpp.exitCode === 0 && cpp.stdout.includes("cpp-ok"), `C++ falló: ${cpp.stderr}`);
} else {
  console.log("c++ no está instalado; se omite C++.");
}

if (hasCommand("javac") && hasCommand("java")) {
  const java = await executeJob({
    id: "88888888-8888-4888-8888-888888888888",
    language: "java",
    filename: "Hola.java",
    source: 'public class Hola { public static void main(String[] args){ System.out.print("java-ok\\n"); } }\n',
    stdin: "",
  });
  assert(java.exitCode === 0 && java.stdout.includes("java-ok"), `Java falló: ${java.stderr}`);
} else {
  console.log("javac no está instalado; se omite Java.");
}

const queuedId = randomUUID();
const createdAt = new Date().toISOString();
await saveSource(queuedId, 'print("desde-cola")\n');
await insertSubmission({
  id: queuedId,
  userId: "dev:ana@escuela.test",
  userEmail: "ana@escuela.test",
  userName: "Ana",
  language: "python",
  filename: "cola.py",
  source: 'print("desde-cola")\n',
  stdin: "",
  status: "queued",
  exitCode: null,
  stdout: "",
  stderr: "",
  command: "",
  createdAt,
  runAt: createdAt,
  scheduled: false,
  startedAt: null,
  finishedAt: null,
});
const summary = await runQueue();
assert(summary.some((item) => item.id === queuedId && item.exitCode === 0), "la cola no ejecutó el trabajo");
const stored = await getOwned(queuedId, "dev:ana@escuela.test");
assert(stored?.status === "finished" && stored.stdout.includes("desde-cola"), "el resultado no quedó en PostgreSQL");
const mine = await listByUser("dev:ana@escuela.test");
const foreign = await getOwned(queuedId, "dev:luis@escuela.test");
assert(mine.some((item) => item.id === queuedId), "el historial del autor no tiene el trabajo");
assert(foreign === null, "otro usuario pudo leer el trabajo");

  await rm(dir, { recursive: true, force: true });
  console.log("ok");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
