# ADR-0007: Asistente con motor de reglas hasta la Fase 10

**Estado:** aceptada · **Fase:** 3

## Contexto

El documento pide un `AiAssistantModule` con `/ai/recommend`, `/ai/substitute` y `/ai/explain`,
pero sitúa la integración de inteligencia artificial en la Fase 10. Además exige "no simular
funcionalidades como si estuvieran implementadas" y no depender de servicios de pago innecesarios.

## Decisión

Los tres endpoints existen y funcionan con **reglas sobre contenido verificado**, sin ningún modelo
de lenguaje, y lo declaran en cada respuesta: `engine: "RULES"`, `llm: false`.

- `recommend`: recetas EXACT_MATCH/ADAPTABLE del motor de coincidencia, con motivos redactados por
  plantilla. Si no hay ninguna, sugiere las que solo carecen de un ingrediente.
- `substitute`: sustituciones **aprobadas** (globales y, si se indica, las de la receta).
- `explain`: arma la explicación con la descripción, las instrucciones, los errores comunes y el
  equipamiento de la técnica, o con los pasos de la receta. Cita los recursos usados en `sources`.

## Fase 10 (plan)

Un proveedor de LLM detrás de una interfaz, desactivado por defecto. Solo podrá **redactar,
resumir u ordenar** resultados ya calculados por el motor y el contenido verificado. No podrá crear
recetas, cambiar clasificaciones ni proponer sustituciones no aprobadas. Sin proveedor configurado,
la API seguirá respondiendo con las reglas: es gratis y funciona offline.
