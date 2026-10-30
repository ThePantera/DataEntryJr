# Fase 6: Recetario y técnicas

## Entregado

- 7 clásicos de la IBA con cantidades, método, vaso, hielo, decoración y pasos: Negroni,
  Daiquiri, Margarita, Manhattan, Mojito, Whiskey Sour y Americano. Se excluyeron las recetas cuya
  especificación usa medidas imprecisas.
- 4 técnicas (batido, refrescado/removido, directo, macerado), con equipamiento y errores comunes.
- En la app: explorar, buscar, detalle con escalado de porciones y alérgenos, y Escuela de
  técnicas. En la API: el flujo editorial completo para publicar recetas nuevas, que la app puede
  descargar ([Fase 3](fase-03.md)).

## Pruebas

`packages/client-core/test/catalog.spec.ts`: listado, búsqueda sin acentos, filtros por categoría
e ingrediente, escalado del Mojito ×4, alérgenos y técnicas. `apps/api/test/e2e/seed.e2e-spec.ts`:
toda receta publicada por el seed cumple los requisitos de publicación.

## Pendiente

Ampliar el recetario es trabajo editorial: cargar recetas por la API (POST /recipes y flujo
DRAFT→PUBLISHED) o en `seed-data.ts`.
