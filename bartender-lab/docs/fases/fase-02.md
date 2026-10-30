# Fase 2: Base de datos y migraciones

## Entregado

- `apps/api/prisma/schema.prisma`: todas las entidades del documento técnico (users, ingredients,
  categories, recipes, recipe_ingredients, recipe_steps, techniques, glassware, equipment, inventory,
  favorites, shopping_lists, shopping_list_items, download_manifest) con relaciones normalizadas,
  más las tablas de soporte justificadas en la [arquitectura](../arquitectura.md#3-modelo-de-datos):
  refresh_tokens, ingredient_substitutions, technique_equipment, recipe_categories y sync_operations.
- Migración inicial `20261030000516_init` con 17 restricciones `CHECK` adicionales.
- Columnas de sincronización: `version` en todo lo descargable o sincronizable y `deleted_at`
  (lápida) en los datos del usuario.
- Seed de desarrollo **idempotente** (`prisma/seed.ts` + `prisma/seed-data.ts`): 14 categorías,
  16 ingredientes, 3 vasos, 7 utensilios, 4 técnicas y 7 clásicos IBA (Negroni, Daiquiri,
  Margarita, Manhattan, Mojito, Whiskey Sour, Americano), más una sustitución aprobada de muestra.
  Es material de desarrollo, no el catálogo editorial de la Fase 5. Las graduaciones son valores
  típicos y la capacidad de los vasos se dejó vacía a propósito.

## Cómo ejecutar

```bash
cd bartender-lab
npm run db:up                                   # PostgreSQL local con Docker
cp apps/api/.env.example apps/api/.env
npm run db:deploy -w @bartender-lab/api         # aplica migraciones
npm run db:seed -w @bartender-lab/api           # carga el catálogo de desarrollo
```

Para cambiar el esquema en desarrollo: editar `schema.prisma` y ejecutar
`npm run db:migrate -w @bartender-lab/api -- --name <cambio>`.

## Pruebas

- `test/e2e/seed.e2e-spec.ts`: toda receta publicada por el seed cumple los requisitos de
  publicación; ejecutar el seed dos veces no cambia nada (ni versiones ni manifiesto); el manifiesto
  anuncia exactamente las recetas publicadas.
- `test/unit/enum-parity.spec.ts`: las enumeraciones de `shared` coinciden con las de Prisma.
- Verificado durante la entrega: `prisma migrate diff` entre migraciones y esquema → _No difference
  detected_.

## Decisiones

[ADR-0005](../adr/0005-sincronizacion.md) (versión, lápidas, manifiesto) ·
[ADR-0006](../adr/0006-motor-de-coincidencia.md) (sustituciones)

## Limitaciones conocidas

- El seed no incluye recetas cuya especificación IBA usa medidas imprecisas (p. ej. Old Fashioned:
  "unos golpes" de amargo); requieren una decisión editorial antes de cargarse.
- Supabase Storage para imágenes no está integrado: las entidades guardan `image_url` (HTTPS).
