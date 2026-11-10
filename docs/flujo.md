# Flujo de una ejecución

Núcleo no revisa el código. Guarda el texto, lo deja en cola y, cuando llega la hora, un proceso aparte lo compila y lo corre. El resultado vuelve a PostgreSQL. La página solo lee esa fila.

Hay dos relojes:

- **Ahora.** Al enviar, la propia app llama a `runQueue` y corre el programa en ese momento.
- **Programar.** La fila queda con una hora futura. El cron, cada minuto, corre solo lo que ya llegó a su hora. Ese envío no tiene botón de play.

La hora del formulario es la de la Ciudad de México (UTC−6, sin horario de verano).

## Quién hace qué

| Pieza | Dónde corre | Qué hace |
| --- | --- | --- |
| App web | `systemd`, servicio `nucleo` (`npm start`) | Login, formulario, historial. Escribe la fila y, si el envío es «Ahora», corre el programa. |
| PostgreSQL | `127.0.0.1:5432`, base `nucleo` | Usuarios, el programa, el estado y el resultado. |
| FTP o disco local | `127.0.0.1:21`, o `data/vps` si `STORAGE_DRIVER=local` | Un solo archivo por envío: `jobs/<id>/source`. |
| Cron | usuario `polo`, cada minuto | `npm run worker`. Es un script, no otro servidor. |

La web no sustituye al cron. El cron no crea la base ni las tablas: eso es `node scripts/init-db.js`.

## Pasos

1. La persona entra con Google. La sesión queda en la cookie `nucleo_session`. Sin esa cookie, `/dashboard`, `/historial` y `/ejecuciones` redirigen a `/login`.
2. En **Enviar** elige lenguaje y pega el código o carga un archivo.
3. El nombre del archivo no se escribe. Si carga un archivo, se usa ese nombre. Si pega código, queda `main.py`, `main.c`, `main.cpp` o, en Java, el nombre de la `public class` (`Hola` → `Hola.java`). Si no hay `public class`, queda `Main.java`.
4. **Ahora** guarda `scheduled = false` y `run_at = ahora`. **Programar** guarda `scheduled = true` y `run_at` en el futuro (entre 1 minuto y 7 días).
5. Se inserta la fila en `submissions` y se escribe un archivo: `jobs/<id>/source`.
6. Si es «Ahora», `runQueue` corre hasta 5 trabajos ya vencidos, entre ellos este, y la página abre la ejecución. Si es «Programar», no se ejecuta nada: la página muestra la hora y espera al cron.
7. El cron, o el play de un envío inmediato que sigue en cola, vuelve a llamar a `runQueue`.
8. `runQueue` toma la fila, lee el archivo, corre el lenguaje y hace `UPDATE` de esa misma fila con stdout, stderr, código de salida y el comando.
9. El historial y la página de la ejecución hacen `SELECT`. No leen un JSON de resultado.

```text
navegador
    │  Enviar
    ▼
app (server action submitCode)
    │  INSERT submissions          estado queued
    │  escribe jobs/<id>/...
    │
    ├─ Ahora ──► runQueue ──► UPDATE submissions (finished)
    │
    └─ Programar ── espera ──► cron, cada minuto
                                  │
                                  ▼
                            scripts/worker.ts
                                  │
                                  ▼
                               runQueue
                                  │
                                  ▼
                            UPDATE submissions
                                  │
                                  ▼
                         historial lee la fila
```

## Qué hace el cron

`scripts/worker.ts` no mantiene un proceso vivo. El cron lo arranca, corre y termina. Carga `.env` y llama a `runQueue` (hasta 20 trabajos). El botón «Ahora» llama a esa misma función.

Un trabajo entra solo si `status` es `queued` y `run_at` ya llegó. Una hora futura no se toca. Si el proceso muere a medias, la fila se queda en `running`; desde el historial se puede borrar.

Por cada uno, en orden:

1. `claimSubmission`: `status = running` y `started_at = now()`. Si otra pasada ya lo tomó, esta lo salta.
2. Lee `jobs/<id>/source`. Si no está, cierra la fila con código 1 y el texto «El trabajo no tiene el archivo fuente.»
3. Copia el texto a un directorio temporal `nucleo-…`, compila o interpreta, y borra ese directorio al terminar.
4. `completeSubmission`: `status = finished`, más `exit_code`, `stdout`, `stderr`, `command`, `started_at` y `finished_at`.

El programa no hereda las variables de FTP, de la base ni de la sesión. Solo ve `PATH`, `HOME`, `TMPDIR`, `LANG` y `LC_ALL`, con el directorio temporal como casa. El tiempo máximo es `RUN_TIMEOUT_SEC` (8 segundos si no se define, tope 120). Si se pasa, el código de salida es 124. La salida se corta alrededor de 64 KB.

Comandos:

| Lenguaje | Qué se ejecuta |
| --- | --- |
| Python | `python3 archivo.py` |
| C | `cc -std=c11 -o program archivo.c -lm` y luego `./program` |
| C++ | `c++ -std=c++17 -o program archivo.cpp` y luego `./program` |
| Java | `javac -encoding UTF-8 Archivo.java` y luego `java Archivo` |

Esos binarios tienen que existir para el usuario que corre el cron y el servicio `nucleo` (`python3`, `cc`, `c++`, `javac`, `java`). En Debian:

```bash
sudo apt install -y python3 build-essential g++ default-jdk-headless
```

## Archivos que se crean

Por cada envío, bajo la raíz de almacenamiento (`FTP_ROOT`, o `data/vps` en local):

```text
jobs/<uuid>/source       el texto del programa, tal cual
```

El lenguaje, el nombre, la hora y el resultado no van en ese archivo. Están en la fila de PostgreSQL. `runQueue` solo lee `source`.

Durante la ejecución aparece un directorio temporal del sistema operativo. Ahí se escribe el `.py`, `.c`, `.cpp` o `.java` y, en C y C++, el binario `program`. Se borra al terminar, también si el compilador falla.

Al pulsar **Eliminar** se borra la fila de ese usuario y el directorio `jobs/<uuid>/`. No borra filas de otra persona.

## Tablas

`users`: `id` (por ejemplo `google:…`), `email`, `name`.

`submissions`: una fila por ejecución.

| Columna | Al enviar | Cuando el worker termina |
| --- | --- | --- |
| `status` | `queued` | `running` al tomarla, luego `finished` |
| `run_at` | ahora, o la hora programada | no cambia |
| `scheduled` | false o true | no cambia |
| `source`, `filename`, `language` | el programa | no cambian |
| `exit_code`, `stdout`, `stderr`, `command` | vacíos | la salida del compilador o del programa |
| `started_at`, `finished_at` | nulos | se llenan al terminar |

El cron no hace `INSERT`. Solo actualiza una fila que la web ya creó. `node scripts/init-db.js` crea la base y las tablas si faltan, y agrega columnas nuevas sin borrar filas. Hay que correrlo en la VPS cada vez que el código espera una columna que la base todavía no tiene (`run_at`, `scheduled`).

## Cron

El servicio `nucleo` mantiene la web. El cron es otra línea, en el crontab de `polo`. `npm` tiene que ser el de Node 22 de nvm, porque el `npm` del sistema puede ser otro Node:

```bash
* * * * * cd /opt/proyectoSO/Proy-Admin-SO && /home/polo/.nvm/versions/node/v22.23.4/bin/npm run worker >> /tmp/nucleo-worker.log 2>&1
```

La versión `v22.23.4` es la carpeta real de `nvm`. Si cambia, la ruta del crontab también. Cada minuto el worker imprime `Sin trabajos pendientes.` o `<uuid>  salida <código>`. Un trabajo programado para dentro de una hora no aparece en ese log hasta que `run_at` ya pasó.

El play de una ejecución inmediata también llama a `runQueue`, pero no adelanta un envío programado. Si el trabajo está marcado `scheduled`, el play no hace nada.

## Código que interviene

| Archivo | Papel |
| --- | --- |
| `src/app/actions.ts` | Enviar, borrar y correr la cola desde la web. |
| `src/lib/db.ts` | `INSERT`, listar, reclamar y cerrar la fila. |
| `src/lib/storage.ts` | Escribir y borrar `jobs/<id>/` por FTP o en disco. |
| `src/lib/queue.ts` | `runQueue`: reclamar, leer el archivo, ejecutar, guardar el resultado. |
| `src/lib/runner.ts` | El proceso de Python, C, C++ o Java. |
| `scripts/worker.ts` | El comando del cron. Solo llama a `runQueue`. |
| `scripts/init-db.js` | Crea la base y las tablas. |

## Límites

- 200 KB de código.
- 30 trabajos sin terminar por usuario.
- 8 segundos por compilación o por ejecución, salvo `RUN_TIMEOUT_SEC` (máximo 120).
- Unos 64 KB de stdout y de stderr.
