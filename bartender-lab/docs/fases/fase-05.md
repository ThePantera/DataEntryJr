# Fase 5: Catálogo inicial de ingredientes

## Entregado

- Catálogo inicial definido una sola vez en `apps/api/prisma/seed-data.ts` y construido con ids
  deterministas por `buildCatalog()`: 16 ingredientes en 9 categorías, con graduación típica y
  alérgenos (vermut → sulfitos), 3 vasos y 7 utensilios.
- La misma fuente alimenta el seed del servidor y el catálogo incorporado en la app
  (`npm run catalog:export -w @bartender-lab/api` regenera `packages/client-core/data/catalog.json`).

## Pruebas

`apps/api/test/unit/catalog.spec.ts` (ids deterministas, sin duplicados, JSON incorporado al día),
`catalog-ids.spec.ts` (vector de referencia del RFC 4122) y `test/e2e/seed.e2e-spec.ts` (el seed
usa los mismos ids que la app).

## Pendiente

El catálogo es deliberadamente pequeño: solo lo que usan las recetas incluidas. Ampliarlo
(destilados por estilo, licores, amargos, frutas, etc.) es trabajo editorial. Añadir datos a
`seed-data.ts` y ejecutar `catalog:export` basta para que llegue a la app y al servidor.
