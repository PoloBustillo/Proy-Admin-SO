import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { safeFilename } from "@/lib/filenames";
import type { JobResult, Language } from "@/lib/types";

const OUTPUT_CAP = 64 * 1024;

type RunOutput = { code: number; stdout: string; stderr: string };

/** Corta la salida para no guardar textos enormes en la base. */
function appendCap(current: string, chunk: string) {
  if (current.includes("[salida truncada]")) return current;
  const next = current + chunk;
  if (next.length <= OUTPUT_CAP) return next;
  return `${next.slice(0, OUTPUT_CAP)}\n[salida truncada]\n`;
}

/** Segundos de RUN_TIMEOUT_SEC. Por defecto 8, máximo 120. */
function timeoutMs() {
  const seconds = Number(process.env.RUN_TIMEOUT_SEC || 8);
  if (!Number.isFinite(seconds) || seconds <= 0) return 8_000;
  return Math.min(seconds, 120) * 1000;
}

/** Mata el proceso y los que haya abierto, por ejemplo el compilador. */
function killTree(child: ChildProcess) {
  if (child.pid == null) return;
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    try {
      child.kill("SIGKILL");
    } catch {
        /* El proceso ya había terminado. */
    }
  }
}

/** Lanza un comando, guarda stdout y stderr, y lo corta si se pasa del tiempo. */
function run(cmd: string, args: string[], cwd: string, limitMs: number) {
  return new Promise<RunOutput>((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    const finish = (code: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    };

    let child: ChildProcess;
    try {
      child = spawn(cmd, args, {
        cwd,
        detached: true,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          PATH: process.env.PATH || "/usr/bin:/bin:/usr/local/bin",
          HOME: cwd,
          TMPDIR: cwd,
          LANG: "C.UTF-8",
          LC_ALL: "C.UTF-8",
        } as unknown as NodeJS.ProcessEnv,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo iniciar el proceso.";
      resolve({ code: 127, stdout: "", stderr: `No se encontró el comando "${cmd}".\n${message}\n` });
      return;
    }

    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, limitMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout = appendCap(stdout, chunk.toString("utf8"));
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = appendCap(stderr, chunk.toString("utf8"));
    });
    child.stdin?.on("error", () => {
      /* El programa cerró la entrada antes de leerla toda. */
    });
    child.on("error", (error) => {
      stderr = appendCap(stderr, `No se encontró el comando "${cmd}".\n${error.message}\n`);
      finish(127);
    });
    child.on("close", (code) => {
      if (timedOut) {
        stderr = appendCap(stderr, "\nTiempo de ejecución agotado.\n");
        finish(124);
        return;
      }
      finish(code ?? 1);
    });
    child.stdin?.end();
  });
}

/** Compila y, si compiló, corre el programa. Si no, devuelve el error del compilador tal cual. */
async function compileAndRun(
  compile: string[],
  runCmd: string,
  runArgs: string[],
  displayRun: string,
  cwd: string,
  limitMs: number,
) {
  const compiled = await run(compile[0], compile.slice(1), cwd, limitMs);
  const compileCommand = compile.join(" ");
  if (compiled.code !== 0) return { ...compiled, command: compileCommand };
  const executed = await run(runCmd, runArgs, cwd, limitMs);
  return { ...executed, command: `${compileCommand} && ${displayRun}` };
}

/** Escribe el código en una carpeta temporal, lo corre y borra esa carpeta. */
export async function executeJob(input: {
  id: string;
  language: Language;
  filename: string;
  source: string;
}): Promise<JobResult> {
  const filename = safeFilename(input.filename, input.language);
  const startedAt = new Date().toISOString();
  const dir = await mkdtemp(path.join(os.tmpdir(), "nucleo-"));
  const limitMs = timeoutMs();

  try {
    await writeFile(path.join(dir, filename), input.source, "utf8");
    let output: RunOutput & { command: string };

    if (input.language === "python") {
      const result = await run("python3", [filename], dir, limitMs);
      output = { ...result, command: `python3 ${filename}` };
    } else if (input.language === "c") {
      output = await compileAndRun(
        ["cc", "-std=c11", "-o", "program", filename, "-lm"],
        path.join(dir, "program"),
        [],
        "./program",
        dir,
        limitMs,
      );
    } else if (input.language === "cpp") {
      output = await compileAndRun(
        ["c++", "-std=c++17", "-o", "program", filename],
        path.join(dir, "program"),
        [],
        "./program",
        dir,
        limitMs,
      );
    } else {
      const className = filename.replace(/\.java$/, "");
      output = await compileAndRun(
        ["javac", "-encoding", "UTF-8", filename],
        "java",
        ["-cp", dir, className],
        `java ${className}`,
        dir,
        limitMs,
      );
    }

    return {
      id: input.id,
      exitCode: output.code,
      stdout: output.stdout,
      stderr: output.stderr,
      command: output.command,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
