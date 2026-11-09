import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client, FTPError } from "basic-ftp";
import { dataDir, localStorageRoot } from "@/lib/paths";
import { isJobId, type JobFile, type JobState } from "@/lib/types";

type Entry = { name: string; kind: "dir" | "file" };

interface StorageIO {
  write(rel: string, content: string): Promise<void>;
  read(rel: string): Promise<string | null>;
  list(rel: string): Promise<Entry[]>;
  removeDir(rel: string): Promise<void>;
}

export function storageDriver() {
  return process.env.STORAGE_DRIVER === "ftp" ? "ftp" : "local";
}

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
    const tmp = `${full}.${randomUUID()}.tmp`;
    await writeFile(tmp, content, "utf8");
    await rename(tmp, full);
  },
  async read(rel) {
    try {
      return await readFile(localPath(rel), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  },
  async list(rel) {
    try {
      const names = await readdir(localPath(rel), { withFileTypes: true });
      return names.map((entry) => ({
        name: entry.name,
        kind: entry.isDirectory() ? "dir" : "file",
      }));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
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
      async list(rel) {
        assertRel(rel);
        await client.cd(base);
        try {
          const entries = await client.list(rel);
          return entries
            .filter((entry) => entry.name !== "." && entry.name !== "..")
            .map((entry) => ({
              name: entry.name,
              kind: entry.isDirectory ? "dir" : "file",
            }));
        } catch (error) {
          if (isMissing(error)) return [];
          throw error;
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

export function withStorage<T>(fn: (io: StorageIO) => Promise<T>) {
  if (storageDriver() === "ftp") return withFtp(fn);
  return fn(localIO);
}

export async function putPendingJob(job: JobFile, source: string) {
  if (!isJobId(job.id)) throw new Error("Identificador inválido.");
  const state: JobState = { status: "queued", claimedAt: null };
  await withStorage(async (io) => {
    await io.write(`jobs/${job.id}/job.json`, JSON.stringify(job));
    await io.write(`jobs/${job.id}/source`, source);
    await io.write(`jobs/${job.id}/state.json`, JSON.stringify(state));
  });
}

export async function removeJob(id: string) {
  if (!isJobId(id)) return;
  await withStorage((io) => io.removeDir(`jobs/${id}`));
}

export async function readSource(id: string) {
  if (!isJobId(id)) return null;
  return withStorage((io) => io.read(`jobs/${id}/source`));
}
