# Núcleo

Ejecuta Python, Java, C y C++ desde la página. No revisa el código. Si el compilador o el programa fallan, esa salida se muestra tal cual.

El comando corre en el mismo servidor que la web. PostgreSQL, en `127.0.0.1`, guarda cada ejecución y su resultado.

El recorrido está en [docs/flujo.md](docs/flujo.md).

## Arranque

PostgreSQL tiene que estar instalado y escuchando solo en localhost.

```bash
npm install
node scripts/init-db.js
npm run dev
```

`node scripts/init-db.js` crea la base `nucleo` si no existe y las tablas `users` y `submissions`. Se puede volver a correr sin borrar datos. También sirve `npm run db:init`.

Abre http://localhost:3000. La entrada es solo con Google.

## Google

Cliente OAuth de tipo aplicación web. Redirect autorizado:

```text
http://localhost:3000/api/auth/google/callback
```

En la VPS, cambia el host por el nombre con el que se abre la app. La base no usa esa URL.

## VPS

La app y PostgreSQL corren en la misma máquina. El servicio `nucleo` es el que lanza `python3`, `cc`, `c++` y `java`.

```text
DATABASE_URL=postgres://nucleo:clave@127.0.0.1:5432/nucleo
```

No abras el puerto 5432 al exterior. Postgres solo debe aceptar conexiones locales.

Hacen falta los compiladores en ese servidor:

```bash
sudo apt install -y python3 build-essential g++ default-jdk-headless
```

## Límites

- 200 KB de código.
- 8 segundos por compilación o ejecución, salvo `RUN_TIMEOUT_SEC` (máximo 120).
- La salida se corta alrededor de 64 KB.
