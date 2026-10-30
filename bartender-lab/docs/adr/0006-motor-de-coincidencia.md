# ADR-0006: Motor de coincidencia determinista y sustituciones documentadas

**Estado:** aceptada · **Fase:** 3

## Contexto

La clasificación ADAPTABLE requiere "una sustitución documentada y compatible", pero el modelo de
datos del documento no tenía dónde documentarla.

## Decisión

- Nueva tabla `ingredient_substitutions (ingredient_id, substitute_id, recipe_id?, ratio, notes,
approved)`. Solo cuentan las filas `approved = true`. Con `recipe_id` nulo la sustitución es
  global; con valor, solo vale para esa receta. Cantidad del sustituto = cantidad original × `ratio`.
- El algoritmo (`packages/shared/src/matching.ts`) es una función pura:
  - los ingredientes opcionales nunca son obligatorios;
  - para cada obligatorio que falta se busca una sustitución aprobada, aplicable a la receta, cuyo
    sustituto tenga el usuario **y no sea ya ingrediente de la receta** (si no, alteraría las
    proporciones);
  - si hay varias, se prefiere la específica de la receta y, a igualdad, la de menor id del
    sustituto, de modo que el resultado no depende del orden de entrada;
  - las sustituciones **no se encadenan** (A→B y B→C no implican A→C);
  - orden del resultado: EXACT_MATCH, ADAPTABLE, INCOMPLETE; luego menos faltantes, menos
    sustituciones, nombre e id.
- El inventario cuenta como disponible salvo que su cantidad sea 0; una cantidad nula significa
  "tengo, sin precisar".
- La respuesta incluye `engine: "DETERMINISTIC_V1"`. Un cambio de reglas exigirá una versión nueva.

## Consecuencias

- La app usará exactamente el mismo código offline.
- La IA (Fase 10) no puede tocar estas reglas: solo recibe los resultados del motor
  ([ADR-0007](0007-asistente-sin-llm.md)).
- Por ahora el motor evalúa en memoria todas las recetas publicadas por petición, lo cual basta
  para cientos de recetas. Si el catálogo crece mucho, se podrá prefiltrar en SQL las recetas que
  contienen al menos un ingrediente disponible (Fase 11).
