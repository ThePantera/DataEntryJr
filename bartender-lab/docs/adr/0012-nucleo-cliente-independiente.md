# ADR-0012: Núcleo del cliente independiente de React Native

**Estado:** aceptada · **Fase:** 8

## Contexto

La lógica offline (SQLite, cola de operaciones, sincronización) es la parte más delicada de la app,
y las pruebas obligatorias exigen probar el funcionamiento sin conexión, la recuperación de la
conexión, la ausencia de duplicados y la resolución de conflictos.

## Decisión

- Toda esa lógica vive en `packages/client-core` y solo depende de una interfaz mínima `Db`
  (`execAsync`, `runAsync`, `getAllAsync`, `getFirstAsync`, `withTransactionAsync`). En el
  teléfono la implementa `expo-sqlite`; en las pruebas, `node:sqlite` (Node 22).
- **Cola de operaciones en el cliente:** cada cambio local se escribe en SQLite y se encola en la
  misma transacción. Se coalescen las operaciones aún no enviadas de una misma entidad (crear y
  borrar sin haber llegado al servidor = nada que enviar). Tras cada respuesta, las operaciones
  posteriores se re-basan sobre la versión nueva del servidor. Un `opId` nunca cambia hasta recibir
  respuesta, y las operaciones "en vuelo" vuelven a la cola si falla la red o la app se cierra.
- **Motor de sincronización:** un solo vuelo; primero envía la cola y luego trae cambios.
  - `CONFLICT`: reemplaza la copia local por la del servidor y deja un aviso al usuario.
  - `MERGED`: re-identifica el registro local con el `canonicalId`.
  - `REJECTED`: descarta la operación (y el registro, si nunca existió en el servidor).
  - Recetas: marca las desactualizadas (versión del manifiesto mayor que la local) y las retiradas
    (`deleted`), sin borrar nunca la copia local.
- **Pruebas:**
  - unitarias con SQLite real (`packages/client-core/test`);
  - integración del núcleo contra la API real por HTTP (`apps/api/test/e2e/offline-sync.e2e-spec.ts`):
    sin servidor, corte y recuperación de conexión, respuesta perdida, mismo favorito en dos
    dispositivos, ediciones concurrentes, borrados propagados, receta desactualizada, receta
    retirada, descarga y lectura offline, y cierre de sesión.
- La búsqueda sin acentos usa un mapa de caracteres explícito en lugar de `String.normalize`, que
  no está garantizado en todos los motores JS móviles.

## Consecuencias

- Las pantallas de React Native son delgadas: leen de los repositorios mediante React Query e
  invalidan las consultas tras cada escritura.
- La interfaz tiene una prueba de humo en navegador (`apps/mobile/scripts/web-smoke.mjs`); su lógica
  está cubierta en `client-core`.
