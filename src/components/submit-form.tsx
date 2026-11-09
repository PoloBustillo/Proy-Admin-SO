"use client";

import { useActionState, useRef, useState } from "react";
import { submitCode, type ActionError } from "@/app/actions";
import { PlayButton } from "@/components/play-button";
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
  const [fromFile, setFromFile] = useState(false);
  const [when, setWhen] = useState<"now" | "later">("now");
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadFile(file: File) {
    const text = await file.text();
    setSource(text);
    setFilename(file.name);
    setFromFile(true);
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

      {fromFile ? (
        <input type="hidden" name="source" value={source} />
      ) : (
        <label className="field">
          <span>Programa</span>
          <textarea
            name="source"
            value={source}
            spellCheck={false}
            maxLength={200000}
            placeholder="Pega el código. No se revisa la sintaxis."
            onChange={(event) => setSource(event.target.value)}
          />
        </label>
      )}

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
          {fromFile ? "Cambiar archivo" : "Cargar archivo"}
        </button>
        {fromFile ? (
          <button
            type="button"
            className="text-sm underline"
            onClick={() => {
              setFromFile(false);
              setSource("");
            }}
          >
            Quitar archivo
          </button>
        ) : (
          <span className="text-sm text-ink-soft">.py, .java, .c, .cpp u otro texto</span>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="field-label">Cuándo</legend>
        <div className="langs">
          <label className={when === "now" ? "lang lang-on" : "lang"}>
            <input
              className="sr-only"
              type="radio"
              name="when"
              value="now"
              checked={when === "now"}
              onChange={() => setWhen("now")}
            />
            Ahora
          </label>
          <label className={when === "later" ? "lang lang-on" : "lang"}>
            <input
              className="sr-only"
              type="radio"
              name="when"
              value="later"
              checked={when === "later"}
              onChange={() => setWhen("later")}
            />
            Programar
          </label>
        </div>
      </fieldset>

      {when === "later" ? (
        <>
          <label className="field">
            <span>Hora, Ciudad de México</span>
            <input name="runAt" type="datetime-local" required />
          </label>
          <div>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? "Guardando…" : "Programar"}
            </button>
          </div>
        </>
      ) : (
        <PlayButton label="Correr ahora" />
      )}
    </form>
  );
}
