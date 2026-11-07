"use client";

import { useActionState, useRef, useState } from "react";
import { submitCode, type ActionError } from "@/app/actions";
import { languageFromFilename } from "@/lib/filenames";
import { LANGUAGES, type Language } from "@/lib/types";

const LABELS: Record<Language, string> = {
  python: "Python",
  java: "Java",
  c: "C",
  cpp: "C++",
};

export function SubmitForm() {
  const [state, action, pending] = useActionState<ActionError, FormData>(submitCode, null);
  const [language, setLanguage] = useState<Language>("python");
  const [filename, setFilename] = useState("");
  const [source, setSource] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadFile(file: File) {
    const text = await file.text();
    setSource(text);
    setFilename(file.name);
    const detected = languageFromFilename(file.name);
    if (detected) setLanguage(detected);
  }

  return (
    <form action={action} className="card flex flex-col gap-4 p-4 sm:p-5">
      {state?.error ? (
        <p className="banner" role="alert">
          {state.error}
        </p>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="field-label">Lenguaje</legend>
        <div className="langs">
          {LANGUAGES.map((item) => (
            <label key={item} className={item === language ? "lang lang-on" : "lang"}>
              <input
                className="sr-only"
                type="radio"
                name="language"
                value={item}
                checked={language === item}
                onChange={() => setLanguage(item)}
              />
              {LABELS[item]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span>Nombre de archivo</span>
        <input
          name="filename"
          value={filename}
          maxLength={80}
          autoComplete="off"
          spellCheck={false}
          placeholder={language === "java" ? "Main.java" : language === "c" ? "main.c" : language === "cpp" ? "main.cpp" : "main.py"}
          onChange={(event) => setFilename(event.target.value)}
        />
      </label>

      <label className="field">
        <span>Programa</span>
        <textarea
          name="source"
          value={source}
          spellCheck={false}
          maxLength={200000}
          placeholder="Pega el código o carga un archivo. No se revisa la sintaxis."
          onChange={(event) => setSource(event.target.value)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files?.[0];
            if (file) void loadFile(file);
          }}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void loadFile(file);
            event.target.value = "";
          }}
        />
        <button type="button" className="btn btn-line" onClick={() => fileRef.current?.click()}>
          Cargar archivo
        </button>
        <span className="text-sm text-ink-soft">.py, .java, .c, .cpp u otro texto</span>
      </div>

      <details>
        <summary className="cursor-pointer font-semibold">Entrada estándar, opcional</summary>
        <label className="field mt-3">
          <span>Se envía tal cual al programa cuando el cron lo ejecute</span>
          <textarea name="stdin" className="short" maxLength={20000} spellCheck={false} />
        </label>
      </details>

      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Guardando…" : "Enviar a la cola"}
        </button>
      </div>
    </form>
  );
}
