# Núcleo

Cola de ejecución para Python, Java, C y C++. No revisa el código. Si el compilador o el programa fallan, esa salida se muestra tal cual.

En la VPS todo es local. No hace falta un dominio: el dominio solo le pondría nombre a la IP para el navegador.

- La app sube el archivo por FTP a `127.0.0.1`.
- Un cron ejecuta ese archivo.
- PostgreSQL, también en `127.0.0.1`, guarda cada ejecución y su resultado (estado, stdout, stderr, código de salida).

El recorrido de un envío, los archivos `jobs/<id>/` y el `UPDATE` del cron están en [docs/flujo.md](docs/flujo.md).

## Arranque

PostgreSQL tiene que estar instalado y escuchando solo en localhost.

```bash
npm install
node scripts/init-db.js
npm run dev
```

`node scripts/init-db.js` crea la base `nucleo` si no existe y las tablas `users` y `submissions`. Se puede volver a correr sin borrar datos. También sirve `npm run db:init`.

Abre http://localhost:3000. La entrada es solo con Google.

```bash
npm run check
```

Eso prueba el runner y que el resultado de la cola queda en PostgreSQL, visible solo para su autor.

## Google

Cliente OAuth de tipo aplicación web. Redirect autorizado:

```text
http://localhost:3000/api/auth/google/callback
```

En la VPS, cambia el host por la IP o el nombre con el que se abre la app. La base no usa esa URL.

## VPS

La app, el FTP, el cron y PostgreSQL corren en la misma máquina.

```text
DATABASE_URL=postgres://nucleo:clave@127.0.0.1:5432/nucleo
STORAGE_DRIVER=ftp
FTP_HOST=127.0.0.1
FTP_PORT=21
FTP_USER=nucleo
FTP_PASSWORD=...
FTP_ROOT=nucleo
```

No abras el puerto 5432 al exterior. Postgres solo debe aceptar conexiones locales.

El primer paso en el servidor, desde la raíz del proyecto, es `node scripts/init-db.js`.

Cron, cada minuto:

```bash
* * * * * cd /ruta/del/proyecto && npm run worker >> /tmp/nucleo-worker.log 2>&1
```

El worker lee el archivo del FTP, lo ejecuta y actualiza la fila en PostgreSQL. El programa corre con tiempo límite y sin las variables de FTP ni de la sesión.

Hacen falta `python3`, `cc`, `c++` y un JDK, según los lenguajes que se entreguen.

En esta laptop, sin servidor FTP, `STORAGE_DRIVER=local` deja los archivos en `data/vps`. La base sigue siendo PostgreSQL en `127.0.0.1`.

## Límites

- 200 KB de código y 20 KB de entrada estándar.
- 8 segundos por compilación o ejecución, salvo `RUN_TIMEOUT_SEC` (máximo 120).
- 30 trabajos sin terminar por usuario.
- La salida se corta alrededor de 64 KB.
