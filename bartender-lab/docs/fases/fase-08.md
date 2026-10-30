# Fase 8: SQLite y sincronización offline

## Entregado

- `packages/client-core`: esquema SQLite local con migraciones, importación versionada del
  catálogo, repositorios, cola de operaciones con coalescencia y rebase, cliente HTTP con refresco
  de token de un solo vuelo y motor de sincronización ([ADR-0012](../adr/0012-nucleo-cliente-independiente.md)).
- En la app: tokens en `expo-secure-store`; sincronización automática al abrir, al recuperar la
  conexión y al volver a primer plano, y manual desde Configuración; avisos de conflicto; recetas
  desactualizadas y retiradas marcadas; pantalla de Descargas.
- Servidor: `GET /substitutions` para que la coincidencia offline use las sustituciones aprobadas.

## Pruebas obligatorias cubiertas

| Prueba (sección 12)              | Dónde                                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Funcionamiento sin conexión      | `offline-sync.e2e-spec.ts`: la app funciona sin servidor configurado y con el servidor caído               |
| Descarga y consulta offline      | `offline-sync.e2e-spec.ts`: descargar una receta nueva y consultarla con el servidor inaccesible           |
| Recuperación de conexión         | `offline-sync.e2e-spec.ts`: cambios hechos sin conexión se envían al volver, sin duplicar                  |
| Sincronización sin duplicaciones | Reintento tras respuesta perdida; el mismo favorito creado en dos dispositivos queda como un solo registro |
| Resolución de conflictos         | Ediciones concurrentes: gana el servidor, la copia local se reemplaza y se avisa al usuario                |

Además: borrados propagados entre dispositivos, receta desactualizada que se actualiza, receta
retirada que se conserva offline y cierre de sesión que borra los datos personales del teléfono.
Unitarias: `packages/client-core/test` (cola, catálogo, búsqueda, formato).

## Cómo ejecutar

```bash
npm test -w @bartender-lab/client-core
npm run test:e2e -w @bartender-lab/api      # incluye offline-sync.e2e-spec.ts (requiere PostgreSQL)
```
