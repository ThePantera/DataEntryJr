# Fase 7: Inventario y buscador inteligente

## Entregado

- **Mi barra**: ingredientes con cantidad y unidad opcionales. Cantidad 0 = agotado (se conserva
  pero no cuenta como disponible).
- **¿Qué puedo preparar?**: el motor determinista compartido (`@bartender-lab/shared`) corre en
  el teléfono sobre SQLite, con los mismos resultados que `POST /recipes/match`. Agrupa en "Tienes
  todo", "Con sustituciones aprobadas" (indica qué sustituir) y, opcionalmente, "Te falta poco" (hasta
  3 faltantes).
- Desde una receta: "Añadir faltantes a la lista de compras", con cantidades escaladas y sin lo que
  ya está en la barra. Desde la lista: "Pasar comprados a Mi barra".

## Pruebas

`packages/client-core/test/catalog.spec.ts` (coincidencia exacta y adaptable desde el inventario,
agotados) y `outbox.spec.ts` (faltantes escalados que omiten lo disponible, listas).
