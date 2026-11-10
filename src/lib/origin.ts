/** URL pública. Google compara el redirect con esta, no con 127.0.0.1. */
export function appOrigin() {
  return process.env.AUTH_URL?.replace(/\/$/, "") ?? "";
}
