import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { safeFilename } from "@/lib/filenames";
import type { JobResult, Language } from "@/lib/types";

type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
  command: string;
};

function commandText(program: string, args: string[]) {
  return [program, ...args].join(" ");
}

// 8 segundos por defecto. RUN_TIMEOUT_SEC puede subirlo, con tope de 120.
const seconds = Number(process.env.RUN_TIMEOUT_SEC || 8);
const timeLimitMs = !Number.isFinite(seconds) || seconds <= 0 ? 8_000 : Math.min(seconds, 120) * 1000;

/**
 * Equivale a escribir el comando en la terminal y esperar a que acabe.
 * Devuelve lo que imprimió y el código de salida.
 * 0 significa que salió bien. 127: no existe el comando. 124: se pasó del tiempo.
 */
function runCommand(program: string, args: string[], folder: string) {
  const command = commandText(program, args);

  return new Promise<CommandResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    let alreadyFinished = false;
    let ranOutOfTime = false;

    let child: ChildProcess;
    try {
      child = spawn(program, args, {
        cwd: folder,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          PATH: process.env.PATH || "/usr/bin:/bin:/usr/local/bin",
          HOME: folder,
          TMPDIR: folder,
          NODE_ENV: "production",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo iniciar el proceso.";
      resolve({
        code: 127,
        stdout: "",
        stderr: `No se encontró el comando "${program}".\n${message}\n`,
        command,
      });
      return;
    }

    const timer = setTimeout(() => {
      ranOutOfTime = true;
      try {
        child.kill("SIGKILL");
      } catch {
        /* Ya había terminado. */
      }
    }, timeLimitMs);

    function finish(code: number) {
      if (alreadyFinished) return;
      alreadyFinished = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr, command });
    }

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.stdin?.on("error", () => {
      /* El programa cerró su entrada. No es un fallo nuestro. */
    });
    child.on("error", (error) => {
      stderr += `No se encontró el comando "${program}".\n${error.message}\n`;
      finish(127);
    });
    child.on("close", (code) => {
      if (ranOutOfTime) {
        stderr += "\nTiempo de ejecución agotado.\n";
        finish(124);
        return;
      }
      finish(code ?? 1);
    });

    // Sin esto, un input() se queda esperando teclado para siempre.
    child.stdin?.end();
  });
}

/**
 * Primero el compilador. Si falla, devolvemos su error y no corremos nada.
 * Si compiló, corremos el programa y devolvemos lo que ese imprimió.
 */
async function compileThenRun(compiler: string[], program: string[], folder: string) {
  const compiled = await runCommand(compiler[0], compiler.slice(1), folder);
  if (compiled.code !== 0) return compiled;

  const executed = await runCommand(program[0], program.slice(1), folder);
  return { ...executed, command: `${compiled.command} && ${executed.command}` };
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
  const folder = await mkdtemp(path.join(os.tmpdir(), "nucleo-"));

  try {
    await writeFile(path.join(folder, filename), input.source, "utf8");

    let result: CommandResult;
    if (input.language === "python") {
      result = await runCommand("python3", [filename], folder);
    } else if (input.language === "c") {
      result = await compileThenRun(["cc", "-o", "program", filename], ["./program"], folder);
    } else if (input.language === "cpp") {
      result = await compileThenRun(["c++", "-o", "program", filename], ["./program"], folder);
    } else {
      const className = filename.replace(/\.java$/, "");
      result = await compileThenRun(["javac", filename], ["java", className], folder);
    }

    return {
      id: input.id,
      exitCode: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
      command: result.command,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
