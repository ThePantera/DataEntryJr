# Fase 3: API REST y documentación Swagger

## Entregado

Prefijo `/api/v1`. Swagger UI en `/api/docs`; contrato en [`docs/api/openapi.json`](../api/openapi.json).

| Grupo                      | Endpoints                                                                                                                                                          | Acceso                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Auth                       | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`                                                                                              | Público, con rate limit estricto                                                     |
| Usuarios                   | `GET/PATCH /users/me`, `PATCH /users/:id/role`                                                                                                                     | Autenticado / ADMIN                                                                  |
| Categorías                 | `GET /categories?kind=`                                                                                                                                            | Público                                                                              |
| Ingredientes               | `GET /ingredients`, `GET /ingredients/:id` · `POST /ingredients`, `PATCH /ingredients/:id`                                                                         | Público · EDITOR/ADMIN                                                               |
| Cristalería y equipamiento | `GET /glassware[/:id]`, `GET /equipment[/:id]`                                                                                                                     | Público                                                                              |
| Técnicas                   | `GET /techniques`, `GET /techniques/:id`                                                                                                                           | Público                                                                              |
| Recetas                    | `GET /recipes`, `GET /recipes/categories`, `GET /recipes/:id?servings=`, `GET /recipes/:id/ingredients?servings=`, `GET /recipes/:id/steps`, `POST /recipes/match` | Público (solo publicadas)                                                            |
| Recetas (editorial)        | `POST /recipes`, `PATCH /recipes/:id`, `POST /recipes/:id/status`                                                                                                  | EDITOR/ADMIN según [ADR-0008](../adr/0008-flujo-editorial.md)                        |
| Inventario                 | `GET/POST /inventory`, `PATCH/DELETE /inventory/:id`                                                                                                               | Autenticado, solo lo propio                                                          |
| Favoritos                  | `GET /favorites`, `POST/DELETE /favorites/:recipeId`                                                                                                               | Autenticado, solo lo propio                                                          |
| Listas de compras          | `GET/POST /shopping-lists`, `GET/PATCH/DELETE /shopping-lists/:id`, `POST /shopping-lists/:id/items`, `PATCH/DELETE /shopping-lists/:id/items/:itemId`             | Autenticado, solo lo propio                                                          |
| Sincronización             | `GET /sync/manifest`, `GET /sync/changes`, `POST /sync/push`                                                                                                       | Público / autenticado para push y datos propios                                      |
| Asistente                  | `POST /ai/recommend`, `/ai/substitute`, `/ai/explain`                                                                                                              | Público; motor de reglas, **sin LLM** ([ADR-0007](../adr/0007-asistente-sin-llm.md)) |
| Salud                      | `GET /health`                                                                                                                                                      | Público                                                                              |

Los 25 endpoints de la sección 6 del documento técnico existen; una prueba e2e lo verifica contra el
documento OpenAPI. Los de usuarios, categorías, cristalería, equipamiento, listas de compras,
escritura de recetas y salud son añadidos que necesitan los módulos pedidos.

## Cómo ejecutar

```bash
cd bartender-lab
npm ci && npm run db:up
cp apps/api/.env.example apps/api/.env       # definir JWT_ACCESS_SECRET aleatorio
npm run db:deploy -w @bartender-lab/api && npm run db:seed -w @bartender-lab/api
npm run build && npm run start -w @bartender-lab/api
open http://localhost:3000/api/docs
```

Ejemplo:

```bash
curl -s localhost:3000/api/v1/recipes | jq '.items[].name'
curl -s "localhost:3000/api/v1/recipes/<id>?servings=4" | jq '.ingredients'
curl -s -X POST localhost:3000/api/v1/recipes/match -H 'Content-Type: application/json' \
  -d '{"ingredientIds":["<id gin>","<id campari>","<id vermut>"]}' | jq '.results'
```

## Pruebas

```bash
npm test            # 75 unitarias (26 shared + 49 API)
npm run test:e2e    # 136 e2e contra PostgreSQL
```

Correspondencia con las pruebas obligatorias del documento (sección 12):

| Prueba obligatoria               | Dónde                                                                                                                                                                                            | Estado           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| Registro e inicio de sesión      | `auth.e2e-spec.ts` (registro, duplicados, validación, login, rotación, reutilización, logout, rate limit)                                                                                        | ✅               |
| Consulta de recetas              | `recipes.e2e-spec.ts` (listado, búsqueda, detalle, pasos, categorías, visibilidad)                                                                                                               | ✅               |
| Coincidencia de ingredientes     | `matching.spec.ts` (shared) + `recipes.e2e-spec.ts` + `user-data.e2e-spec.ts` (con inventario)                                                                                                   | ✅               |
| Escalado de cantidades           | `scaling.spec.ts` (shared) + `recipes.e2e-spec.ts`                                                                                                                                               | ✅               |
| Control de permisos              | `users.e2e-spec.ts` (cambio de rol inmediato, último admin, tokens falsificados o de usuarios borrados) + `auth`, `catalog`, `recipes`, `user-data` y `sync` (roles, aislamiento entre usuarios) | ✅               |
| Sincronización sin duplicaciones | `sync.e2e-spec.ts` (reintento del mismo lote, misma operación concurrente, favoritos/inventario creados en dos dispositivos)                                                                     | ✅ lado servidor |
| Resolución de conflictos         | `conflict-rules.spec.ts` + `sync.e2e-spec.ts` (versión obsoleta, borrado contra edición)                                                                                                         | ✅ lado servidor |
| Funcionamiento sin conexión      | Requiere la app (SQLite)                                                                                                                                                                         | ⏳ Fase 8        |
| Descarga y consulta offline      | Requiere la app; el servidor ya expone manifiesto y contenido público                                                                                                                            | ⏳ Fase 8        |
| Recuperación de conexión         | Requiere el cliente de sincronización                                                                                                                                                            | ⏳ Fase 8        |

Verificación manual hecha en la entrega: build de producción, arranque con `node dist/main.js`
contra la base sembrada y peticiones reales a `/health`, `/recipes`, escalado ×4 del Mojito,
`/recipes/match` (Negroni exacto y Manhattan adaptable con bourbon), `/api/docs` (200), `/inventory`
sin token (401) y cabeceras de Helmet.

## Decisiones

[ADR-0003](../adr/0003-hash-de-contrasenas.md) · [ADR-0004](../adr/0004-autenticacion.md) ·
[ADR-0005](../adr/0005-sincronizacion.md) · [ADR-0006](../adr/0006-motor-de-coincidencia.md) ·
[ADR-0007](../adr/0007-asistente-sin-llm.md) · [ADR-0008](../adr/0008-flujo-editorial.md)

## Limitaciones conocidas y pendientes

- **Rate limiting en memoria:** con varias instancias de la API cada una cuenta por separado. Para
  escalar hará falta un almacenamiento compartido (p. ej. Redis autoalojado), en la Fase 11.
- **Purga de `sync_operations`** (más de 30 días): no implementada; Fase 11.
- **Escritura de técnicas, cristalería, equipamiento, categorías y sustituciones:** por ahora solo
  vía seed o migraciones; los endpoints editoriales llegarán con el contenido de las Fases 5–6.
- **Imágenes:** solo URLs; la subida a Supabase Storage no está implementada.
- **Detrás de un proxy** hay que poner `TRUST_PROXY=1` para que el rate limit use la IP real.
- **Errores de base de datos:** el filtro global nunca registra ni devuelve el mensaje de Prisma, porque puede incluir valores de la fila (p. ej. un hash de contraseña); solo registra la clase y el código del error.
