import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client, FTPError } from "basic-ftp";
import { dataDir, localStorageRoot } from "@/lib/paths";
import { isJobId } from "@/lib/types";

// El cron lee el programa desde aquí. En la VPS es FTP a 127.0.0.1.
// En la laptop, el mismo código escribe en data/vps.
type StorageIO = {
  write(rel: string, content: string): Promise<void>;
  read(rel: string): Promise<string | null>;
  removeDir(rel: string): Promise<void>;
};

function assertRel(rel: string) {
  if (!rel || rel.startsWith("/") || rel.includes("..") || rel.includes("\\")) {
    throw new Error("Ruta de almacenamiento inválida.");
  }
}

function localPath(rel: string) {
  assertRel(rel);
  const root = path.resolve(localStorageRoot());
  const full = path.resolve(root, rel);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error("Ruta de almacenamiento inválida.");
  }
  return full;
}

const localIO: StorageIO = {
  async write(rel, content) {
    const full = localPath(rel);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, content, "utf8");
  },
  async read(rel) {
    try {
      return await readFile(localPath(rel), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  },
  async removeDir(rel) {
    await rm(localPath(rel), { recursive: true, force: true });
  },
};

function isMissing(error: unknown) {
  return error instanceof FTPError && error.code === 550;
}

async function withFtp<T>(fn: (io: StorageIO) => Promise<T>): Promise<T> {
  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  if (!host || !user) throw new Error("FTP: faltan FTP_HOST o FTP_USER.");

  const secureEnv = process.env.FTP_SECURE;
  const secure = secureEnv === "implicit" ? "implicit" : secureEnv === "true";
  const client = new Client(20_000);

  try {
    await client.access({
      host,
      port: Number(process.env.FTP_PORT || 21),
      user,
      password: process.env.FTP_PASSWORD || "",
      secure,
    });

    const root = (process.env.FTP_ROOT ?? "nucleo").trim();
    if (root && root !== "." && root !== "/") {
      await client.ensureDir(root.replace(/^\/+|\/+$/g, ""));
    }
    const base = await client.pwd();

    const io: StorageIO = {
      async write(rel, content) {
        assertRel(rel);
        await client.cd(base);
        const directory = path.posix.dirname(rel);
        const file = path.posix.basename(rel);
        if (directory !== ".") await client.ensureDir(directory);
        const tmp = path.join(dataDir(), `upload-${randomUUID()}.tmp`);
        await mkdir(dataDir(), { recursive: true });
        await writeFile(tmp, content, "utf8");
        try {
          await client.uploadFrom(tmp, file);
        } finally {
          await rm(tmp, { force: true });
        }
        await client.cd(base);
      },
      async read(rel) {
        assertRel(rel);
        await client.cd(base);
        const tmp = path.join(dataDir(), `download-${randomUUID()}.tmp`);
        await mkdir(dataDir(), { recursive: true });
        try {
          await client.downloadTo(tmp, rel);
          return await readFile(tmp, "utf8");
        } catch (error) {
          if (isMissing(error)) return null;
          throw error;
        } finally {
          await rm(tmp, { force: true });
        }
      },
      async removeDir(rel) {
        assertRel(rel);
        await client.cd(base);
        try {
          await client.removeDir(rel);
        } catch (error) {
          if (isMissing(error)) return;
          throw error;
        }
      },
    };

    return await fn(io);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("FTP:")) throw error;
    const message = error instanceof Error ? error.message : "falló la conexión FTP";
    throw new Error(`FTP: ${message}`);
  } finally {
    client.close();
  }
}

function withStorage<T>(fn: (io: StorageIO) => Promise<T>) {
  if (process.env.STORAGE_DRIVER === "ftp") return withFtp(fn);
  return fn(localIO);
}

/** Guarda el texto del programa en jobs/<id>/source. El cron lee ese archivo. */
export async function saveSource(id: string, source: string) {
  if (!isJobId(id)) throw new Error("Identificador inválido.");
  await withStorage((io) => io.write(`jobs/${id}/source`, source));
}

/** Borra la carpeta del trabajo en el FTP o en data/vps. */
export async function removeJob(id: string) {
  if (!isJobId(id)) return;
  await withStorage((io) => io.removeDir(`jobs/${id}`));
}

/** Lee el texto que se guardó al enviar. Null si el archivo ya no está. */
export async function readSource(id: string) {
  if (!isJobId(id)) return null;
  return withStorage((io) => io.read(`jobs/${id}/source`));
}
