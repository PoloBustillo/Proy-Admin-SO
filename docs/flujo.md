# Flujo de una ejecución

Núcleo no revisa el código. Al pulsar **Correr**, el servidor donde está la página ejecuta el programa y guarda el resultado en PostgreSQL.

1. La persona entra con Google. La cookie `nucleo_session` identifica la sesión.
2. En **Enviar** elige Python, Java, C o C++ y pega el código o carga un archivo.
3. El nombre no se escribe. Si carga un archivo, se usa ese nombre. Si pega código, queda `main-20261111-194032.py` (o `.c`, `.cpp`), con la fecha y hora de la Ciudad de México. En Java, si hay `public class Hola`, el archivo es `Hola.java`.
4. `submitCode` llama a `executeJob` en el mismo proceso de la web. El texto se escribe en una carpeta temporal, se lanza el comando y esa carpeta se borra.
5. La salida, el error y el código de salida se insertan en `submissions`.
6. La página de la ejecución lee esa fila. El historial lista las filas de esa cuenta.

| Lenguaje | Comando |
| --- | --- |
| Python | `python3 archivo.py` |
| C | `cc -o program archivo.c` y luego `./program` |
| C++ | `c++ -o program archivo.cpp` y luego `./program` |
| Java | `javac -encoding UTF-8 Archivo.java` y luego `java Archivo` |

En la VPS esos comandos tienen que estar instalados para el usuario del servicio `nucleo`:

```bash
sudo apt install -y python3 build-essential g++ default-jdk-headless
```

El tiempo máximo es `RUN_TIMEOUT_SEC` (8 segundos si no se define, tope 120). Si se pasa, el código de salida es 124.

## Tablas

`users`: `id`, `email`, `name`.

`submissions`: una fila por ejecución, con el programa, el comando, stdout, stderr y el código de salida.

`node scripts/init-db.js` crea la base `nucleo` y esas tablas. Se puede correr otra vez sin borrar filas.

## Código

| Archivo | Papel |
| --- | --- |
| `src/app/actions.ts` | Correr el programa y borrar una fila. |
| `src/lib/runner.ts` | Lanza Python, C, C++ o Java. |
| `src/lib/db.ts` | Guarda y lee las filas. |
| `scripts/init-db.js` | Crea la base y las tablas. |
