# ADR-0010: App offline-first con catálogo incorporado y servidor opcional

**Estado:** aceptada · **Fases:** 4–8

## Contexto

El usuario pidió un APK instalable y usable, y recordó que la app debe ser gratuita. Publicar la API
en internet tendría un costo de alojamiento. El documento técnico exige además que las recetas
descargadas funcionen sin conexión y sin autenticación.

## Decisión

- El APK incluye el **catálogo inicial** (`packages/client-core/data/catalog.json`) y lo carga en
  SQLite en el primer arranque. Recetario, técnicas, Mi barra, favoritos, listas de compras, búsqueda,
  "¿Qué puedo preparar?", escalado y modo preparación funcionan **sin servidor y sin cuenta**.
- El servidor es **opcional** (Configuración → dirección del servidor). Al conectarlo se pueden
  crear cuentas, sincronizar los datos personales entre dispositivos y descargar o actualizar
  recetas.
- Los ids del catálogo son UUID v5 deterministas (`apps/api/prisma/catalog-ids.ts`), así que el
  seed del servidor y el catálogo incorporado comparten identificadores: un favorito creado offline
  sincroniza contra la misma receta del servidor. Una prueba unitaria exige que el JSON incorporado
  coincida con `buildCatalog()`, y otra e2e que el seed use esos mismos ids.
- Los datos creados sin cuenta quedan en la cola de operaciones. Al iniciar sesión por primera
  vez se envían a esa cuenta.

## Consecuencias

- Una versión nueva de la app puede traer un catálogo más nuevo. La importación es por versión y
  nunca pisa una receta descargada más reciente.
- Al cerrar sesión se intentan enviar los cambios pendientes y luego se borran del teléfono los
  datos personales; el recetario se conserva.
