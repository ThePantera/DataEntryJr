# Arquitectura de BARTENDER LAB

## 1. Vista general

```
┌─────────────────────────────┐        HTTPS / JSON         ┌──────────────────────────────┐
│ App móvil (Expo SDK 54)     │ ──────────────────────────► │ API REST NestJS  /api/v1     │
│  · SQLite (copia local)     │ ◄────────────────────────── │  · Guards: rate limit → JWT  │
│  · cola de operaciones      │                             │    → roles                   │
│  · @bartender-lab/shared    │                             │  · @bartender-lab/shared     │
└─────────────────────────────┘                             └──────────────┬───────────────┘
                                                                           │ Prisma 6
                                                                   ┌───────▼────────┐
                                                                   │ PostgreSQL 16  │
                                                                   │ (fuente de     │
                                                                   │  verdad)       │
                                                                   └────────────────┘
```

- **PostgreSQL** es la fuente principal de información. Puede alojarse en Supabase u otro
  proveedor; la API solo necesita un `DATABASE_URL` estándar (sin dependencias de pago).
- **`@bartender-lab/shared`** contiene la lógica que debe dar el mismo resultado con o sin
  conexión: el motor de coincidencia y el escalado de cantidades. La API y la app importan el
  mismo código ([ADR-0001](adr/0001-monorepo-y-dominio-compartido.md)).
- Las imágenes se referencian por URL HTTPS (`image_url`). Subirlas a Supabase Storage u otro
  almacenamiento queda fuera de las Fases 1–3.

## 2. Módulos de la API

| Módulo                                           | Responsabilidad                                                            | Rutas                          |
| ------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------ |
| `AuthModule`                                     | Registro, login, rotación y revocación de refresh tokens; guard JWT global | `/auth/*`                      |
| `UsersModule`                                    | Perfil propio; cambio de rol (solo ADMIN)                                  | `/users/*`                     |
| `CategoriesModule`                               | Categorías de ingredientes y de recetas                                    | `/categories`                  |
| `IngredientsModule`                              | Catálogo de ingredientes; escritura EDITOR/ADMIN                           | `/ingredients/*`               |
| `GlasswareModule`, `EquipmentModule`             | Cristalería y equipamiento                                                 | `/glassware/*`, `/equipment/*` |
| `TechniquesModule`                               | Escuela de técnicas                                                        | `/techniques/*`                |
| `RecipesModule`                                  | Consulta, escalado, coincidencia y flujo editorial                         | `/recipes/*`                   |
| `InventoryModule`                                | "Mi barra" del usuario                                                     | `/inventory/*`                 |
| `FavoritesModule`                                | Favoritos                                                                  | `/favorites/*`                 |
| `ShoppingListsModule`                            | Listas de compras e ítems                                                  | `/shopping-lists/*`            |
| `SyncModule`                                     | Manifiesto, cambios por cursor y cola de operaciones                       | `/sync/*`                      |
| `AiAssistantModule`                              | Recomendar, sustituir y explicar (motor de reglas)                         | `/ai/*`                        |
| `ManifestModule`, `PrismaModule`, `ConfigModule` | Infraestructura compartida                                                 | —                              |

El pipeline HTTP es idéntico en producción y en las pruebas (`configureApp` en `src/app.setup.ts`):
prefijo `/api/v1`, Helmet, `ValidationPipe` global (`whitelist` + `forbidNonWhitelisted`: un campo
no declarado, como un `role` autoasignado, da 400), filtro de errores de Prisma sin filtrar datos y,
opcionalmente, Swagger en `/api/docs`.

## 3. Modelo de datos

Todas las entidades del documento técnico existen con relaciones normalizadas; los ingredientes
de una receta viven en `recipe_ingredients` y nunca como texto libre. Además:

| Tabla añadida              | Motivo                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `refresh_tokens`           | Sesiones revocables ([ADR-0004](adr/0004-autenticacion.md)).                                                     |
| `ingredient_substitutions` | Sustituciones documentadas que exige la clasificación ADAPTABLE ([ADR-0006](adr/0006-motor-de-coincidencia.md)). |
| `technique_equipment`      | Normaliza el campo `equipment` de las técnicas.                                                                  |
| `recipe_categories`        | Categorías de recetas para `GET /recipes/categories`.                                                            |
| `sync_operations`          | Idempotencia de `POST /sync/push` ([ADR-0005](adr/0005-sincronizacion.md)).                                      |

Columnas añadidas: `version` en todo recurso descargable o sincronizable; `deleted_at` (lápida)
en los datos del usuario; `origin` (CLASSIC/ORIGINAL), `servings`, `slug`, `published_at` y
`created_by_id` en recetas; `kind` en categorías; `position` en ingredientes de receta.
Las unidades de tiempo se explicitan en el nombre (`preparation_time_seconds`, `duration_seconds`).
La migración inicial añade restricciones `CHECK` (cantidades positivas, porcentajes 0–100, email en
minúsculas, una sustitución no puede ser el mismo ingrediente…).

## 4. Seguridad

| Requisito del documento                         | Implementación                                                                                                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nunca contraseñas en texto plano                | scrypt (N=2¹⁷, r=8, p=1) con sal aleatoria; parámetros guardados en el hash ([ADR-0003](adr/0003-hash-de-contrasenas.md)).                                       |
| JWT + refresh tokens                            | Access token HS256 de 15 min; refresh token opaco de un solo uso, guardado como SHA-256, con detección de reutilización ([ADR-0004](adr/0004-autenticacion.md)). |
| Validación DTO                                  | `class-validator` en todas las entradas, incluidas las cargas de `/sync/push`.                                                                                   |
| Rate limiting                                   | Global (120/min por IP) y estricto en `/auth/*` (10/min), configurables.                                                                                         |
| Autorización por usuario                        | Toda consulta de datos personales filtra por `user_id`; un registro ajeno responde 404, igual que uno inexistente.                                               |
| Endpoints administrativos                       | `@Roles('EDITOR','ADMIN')` y reglas del flujo editorial; el rol se relee de la base en cada petición.                                                            |
| Recetas oficiales protegidas                    | Un USER no puede escribir recetas; un EDITOR no puede editar recetas VERIFIED/PUBLISHED ni publicar ([ADR-0008](adr/0008-flujo-editorial.md)).                   |
| No exponer credenciales / no registrar secretos | Configuración validada al arrancar sin imprimir valores; logs de Prisma sin consultas ni parámetros; errores 500 genéricos.                                      |
| Tokens en el móvil                              | (Fase 4/8) en `expo-secure-store`, nunca en SQLite.                                                                                                              |

## 5. Arquitectura online/offline

PostgreSQL es la fuente de verdad del servidor. La app trae el catálogo inicial incorporado y guarda
en SQLite las recetas y los datos personales; funciona completa **sin servidor**
([ADR-0010](adr/0010-app-offline-first-con-catalogo-incorporado.md)). El cliente vive en
`packages/client-core` ([ADR-0012](adr/0012-nucleo-cliente-independiente.md)) y el protocolo, con
sus reglas de conflicto, en [ADR-0005](adr/0005-sincronizacion.md). En resumen:

**Contenido público (recetas, técnicas, ingredientes…)**

1. `GET /sync/manifest` devuelve `(tipo, id, versión)` de cada recurso publicado, sin autenticación.
2. El cliente compara con sus copias: si la versión del servidor es mayor, la copia local está
   **desactualizada** y la app lo indica (requisito "informar cuando una receta local esté
   desactualizada"). Luego descarga el detalle con `GET /recipes/:id`.
3. `GET /sync/changes?since=<cursor>` devuelve solo lo que cambió. Una entrada con
   `deleted: true` significa que el recurso se despublicó. La app puede conservar su copia marcada
   como retirada: **una falla de conexión nunca borra contenido descargado**.

**Datos del usuario (favoritos, inventario, listas)**

1. Offline, cada cambio se guarda en SQLite y se encola como operación
   `{opId, entityType, action, entityId, baseVersion, payload}` con UUID generados por el cliente.
2. Al recuperar conexión, la cola se envía en orden a `POST /sync/push`. Cada operación se aplica
   en su propia transacción y queda registrada por `opId`: reenviarla, por ejemplo tras perder
   la respuesta o desde dos peticiones a la vez, devuelve el mismo resultado sin duplicar nada.
3. Resultado por operación: `APPLIED`, `MERGED` (ya existía el mismo registro con otro id; usar
   `canonicalId`), `CONFLICT` (gana el servidor; reemplazar la copia local por `entity`) o
   `REJECTED` (descartar).
4. Después, `GET /sync/changes` con token trae los cambios hechos en otros dispositivos, incluidas
   las lápidas (`deletedAt`).

Las recetas descargadas se pueden usar **sin autenticación y sin conexión**: todos los endpoints de
contenido son públicos y la app los consulta desde SQLite.

## 6. Motor de coincidencia

Algoritmo determinista en `packages/shared/src/matching.ts`
([ADR-0006](adr/0006-motor-de-coincidencia.md)):

- **EXACT_MATCH**: están todos los ingredientes obligatorios.
- **ADAPTABLE**: cada obligatorio que falta tiene una sustitución **aprobada** y compatible que el
  usuario sí tiene.
- **INCOMPLETE**: falta algún obligatorio sin sustitución aprobada.

Los ingredientes opcionales nunca cuentan como obligatorios. Una sustitución es compatible si es
global o específica de esa receta, y el sustituto no es ya un ingrediente de la receta. Las
sustituciones no se encadenan. Un ítem de inventario con cantidad 0 cuenta como agotado. La IA no
puede modificar estas reglas: el asistente consume los resultados del motor
([ADR-0007](adr/0007-asistente-sin-llm.md)).

## 7. Sistema de contenido

`DRAFT → REVIEW → VERIFIED → PUBLISHED`, con vuelta a `DRAFT`. Solo las recetas `PUBLISHED` son
visibles al público. Para pasar a `VERIFIED` o `PUBLISHED` hacen falta cantidades, método
(técnica), vaso, hielo, al menos un paso y, en los clásicos, una fuente documental. Las creaciones
originales llevan `origin: ORIGINAL`, y la API expone `isOfficialClassic` (clásico y publicado)
para distinguirlas. Detalle en [ADR-0008](adr/0008-flujo-editorial.md).
