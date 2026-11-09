"use client";

import { useFormStatus } from "react-dom";
import { deleteSubmission } from "@/app/actions";

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending}>
      {pending ? "…" : "Eliminar"}
    </button>
  );
}

export function DeleteJobForm({ id }: { id: string }) {
  return (
    <form
      action={deleteSubmission}
      onSubmit={(event) => {
        if (!window.confirm("¿Eliminar esta ejecución del historial?")) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <DeleteButton />
    </form>
  );
}
