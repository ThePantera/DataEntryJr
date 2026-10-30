# ADR-0005: Protocolo de sincronización y reglas de conflicto

**Estado:** aceptada · **Fase:** 3 (servidor). El cliente se implementa en la Fase 8.

## Contexto

El documento exige UUID, versiones, ausencia de duplicados, una cola de operaciones pendientes,
reglas explícitas de conflicto, no borrar contenido descargado por una falla de conexión y avisar
cuando una receta local está desactualizada.

## Decisión

### Identidad y versión

- Todos los registros usan UUID. Los datos del usuario pueden crearse con un UUID **generado por el
  cliente**, de modo que el registro tiene el mismo id offline y online.
- Cada recurso tiene `version` (entero, empieza en 1 y se incrementa en cada cambio).
- Los datos del usuario no se borran físicamente: `deleted_at` deja una **lápida** que se propaga
  al resto de dispositivos.

### Contenido público

- `download_manifest` guarda `(tipo, id, versión, deleted, updated_at)` de cada recurso público. Se
  actualiza **en la misma transacción** que el cambio de contenido, así que nunca anuncia una
  versión que no existe. `npm run manifest:rebuild` lo recalcula si hiciera falta.
- Despublicar una receta deja `deleted: true`. El cliente conserva su copia marcada como retirada
  y solo la borra si el usuario lo decide.

### Cursor de cambios

- `GET /sync/changes?since=` devuelve los cambios con `updated_at > since` y un `nextSince`.
- `nextSince = max(since, inicio de la petición − 5 s)`. Una transacción que empezó antes de la
  lectura pero confirmó después tiene un `updated_at` algo anterior a la lectura. La ventana de
  5 s hace que la siguiente consulta la incluya. El precio es que un cambio puede llegar dos veces,
  algo inocuo porque el cliente aplica por `(id, version)`: ignora versiones que no son mayores que
  la local.
- Supuesto: instancias de la API con relojes sincronizados por NTP y transacciones de menos de 5 s.

### Cola de operaciones (`POST /sync/push`)

- Lotes de hasta 100 operaciones `{opId, entityType, action, entityId, baseVersion, payload}`,
  procesadas en orden, **una transacción por operación**: un fallo no deshace las anteriores.
- **Idempotencia:** al iniciar la transacción se inserta `(user_id, op_id)` en `sync_operations`
  (único) y al final se guarda el resultado. Un reenvío devuelve el resultado guardado con
  `replayed: true`. Si dos peticiones concurrentes traen la misma operación, la segunda espera el
  bloqueo, choca con la clave única y devuelve el resultado de la primera.
- `UPSERT` envía el **estado completo** del registro: un campo opcional omitido se guarda vacío.

### Reglas de conflicto (`src/sync/conflict-rules.ts`)

| Situación                                                                      | Resultado                                                                                |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| UPSERT de un id desconocido                                                    | Se crea (`APPLIED`).                                                                     |
| UPSERT con `baseVersion` igual a la del servidor                               | Se actualiza (`APPLIED`).                                                                |
| UPSERT con otra `baseVersion`                                                  | `CONFLICT/STALE_VERSION`: **gana el servidor**; el cliente recibe la copia del servidor. |
| UPSERT de un registro borrado en el servidor                                   | `CONFLICT/DELETED_ON_SERVER`: **gana el borrado**.                                       |
| DELETE de un id desconocido o ya borrado                                       | `APPLIED` (idempotente).                                                                 |
| DELETE con `baseVersion` igual a la del servidor                               | Borrado lógico (`APPLIED`).                                                              |
| DELETE con otra `baseVersion`                                                  | `CONFLICT/STALE_VERSION`: **gana la edición más reciente**.                              |
| Mismo favorito creado en dos dispositivos con ids distintos                    | `MERGED` con `canonicalId`: un único registro.                                           |
| Mismo ingrediente en el inventario (o en una lista) creado en dos dispositivos | `CONFLICT/DUPLICATE` con `canonicalId`: se conserva el primero, sin sumar cantidades.    |
| Recrear algo que tiene una lápida para la misma clave natural                  | Se revive el registro existente (`MERGED`).                                              |
| Registro de otro usuario                                                       | `REJECTED/NOT_FOUND`, sin revelar si existe.                                             |
| Carga inválida, ingrediente inexistente, receta no publicada o lista borrada   | `REJECTED` con motivo.                                                                   |

Las claves naturales `(usuario, receta)`, `(usuario, ingrediente)` y `(lista, ingrediente)` son
únicas en la base: aunque fallara la lógica, la base impide duplicados.

## Alternativas descartadas

- **Última escritura gana por reloj del cliente:** los relojes de los móviles no son fiables y
  se perderían ediciones en silencio.
- **CRDT:** desproporcionado para favoritos, inventario y listas.

## Consecuencias

- El cliente debe: (1) guardar la cola en SQLite y reenviar con el **mismo** `opId` hasta recibir
  respuesta; (2) aplicar `canonicalId` (re-identificar el registro local); (3) ante `CONFLICT`,
  reemplazar su copia y avisar al usuario; (4) descartar las operaciones `REJECTED`.
- `sync_operations` crece con el uso. Conviene purgar las filas de más de 30 días (pendiente,
  Fase 11).
- Un `replayed` devuelve la entidad tal como estaba al aplicarse la operación; el estado actual
  llega con `GET /sync/changes`.
