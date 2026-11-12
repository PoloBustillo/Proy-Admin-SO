import path from "node:path";
import type { Language } from "@/lib/types";

const EXTENSION: Record<Language, string> = {
  python: ".py",
  java: ".java",
  c: ".c",
  cpp: ".cpp",
};

const FALLBACK: Record<Language, string> = {
  python: "main.py",
  java: "Main.java",
  c: "main.c",
  cpp: "main.cpp",
};

/** Quita carpetas y caracteres raros, y pone la extensión del lenguaje. */
export function safeFilename(name: string, language: Language) {
  const extension = EXTENSION[language];
  let base = path
    .basename(name || "")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 80);

  if (!base) return FALLBACK[language];
  if (base.startsWith("-")) base = `p${base}`;
  if (!base.toLowerCase().endsWith(extension)) base += extension;
  return base;
}

/** Fecha y hora de la Ciudad de México, para que el nombre no sea siempre main. */
function dateStamp(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}${value("month")}${value("day")}-${value("hour")}${value("minute")}${value("second")}`;
}

/** Nombre automático al pegar código. Si cargaron un archivo, se usa el nombre de ese archivo. */
export function filenameFor(language: Language, source: string, given: string) {
  const provided = given.trim();
  if (provided) return safeFilename(provided, language);
  if (language === "java") {
    const match = source.match(/public\s+class\s+([A-Za-z_][A-Za-z0-9_]*)/);
    if (match) return safeFilename(`${match[1]}.java`, language);
  }
  const base = language === "java" ? "Main" : "main";
  return safeFilename(`${base}-${dateStamp(new Date())}`, language);
}

/** Al cargar un archivo, elige el lenguaje por la extensión. */
export function languageFromFilename(name: string): Language | null {
  const extension = name.split(".").pop()?.toLowerCase();
  if (extension === "py") return "python";
  if (extension === "java") return "java";
  if (extension === "c") return "c";
  if (extension === "cpp" || extension === "cc" || extension === "cxx") return "cpp";
  return null;
}
