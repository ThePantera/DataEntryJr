# ADR-0008: Flujo editorial y permisos por rol

**Estado:** aceptada · **Fase:** 3

## Decisión

Roles: `USER` (por defecto al registrarse), `EDITOR` y `ADMIN`. El rol no se puede autoasignar: el
registro rechaza campos no declarados, y solo un ADMIN cambia roles (`PATCH /users/:id/role`), sin
poder degradar al último administrador.

| Transición                      | Quién         | Requiere receta completa |
| ------------------------------- | ------------- | ------------------------ |
| DRAFT → REVIEW                  | EDITOR, ADMIN | No                       |
| REVIEW → DRAFT                  | EDITOR, ADMIN | No                       |
| REVIEW → VERIFIED               | EDITOR, ADMIN | Sí                       |
| VERIFIED → DRAFT                | EDITOR, ADMIN | No                       |
| VERIFIED → PUBLISHED            | **ADMIN**     | Sí                       |
| PUBLISHED → DRAFT (despublicar) | **ADMIN**     | No                       |

Cualquier otra transición (por ejemplo DRAFT → PUBLISHED) responde 409.

"Completa" = al menos un ingrediente obligatorio, cantidades en todo lo medible (`TOP_UP` no lleva
cantidad), técnica (método), vaso, tipo de hielo (`NONE` es un valor explícito), al menos un paso y,
en los clásicos, una fuente. Si falta algo, la respuesta es 422 con la lista de `issues`.

Edición de contenido: un EDITOR solo edita recetas en DRAFT o REVIEW. Las recetas VERIFIED y
PUBLISHED (las oficiales) solo las edita un ADMIN, y la edición se rechaza (422) si dejaría la receta
incompleta. Las ediciones usan `version` para la concurrencia optimista (409 si está
desactualizada) y, si la receta está publicada, actualizan el manifiesto en la misma transacción.

Las recetas se crean siempre en DRAFT. `origin: ORIGINAL` identifica las creaciones propias, y la API
expone `isOfficialClassic = origin == CLASSIC && status == PUBLISHED`.

## Consecuencias

- Las recetas no publicadas responden 404 a usuarios comunes y anónimos.
- Cambiar de estado no incrementa `version` (no cambia el contenido), pero publicar o despublicar sí
  actualiza el manifiesto.
