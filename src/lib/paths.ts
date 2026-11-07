import path from "node:path";

export function dataDir() {
  return process.env.NUCLEO_DATA_DIR || path.join(process.cwd(), "data");
}

export function localStorageRoot() {
  return process.env.LOCAL_STORAGE_ROOT || path.join(dataDir(), "vps");
}
