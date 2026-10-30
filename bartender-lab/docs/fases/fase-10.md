# Fase 10: Inteligencia artificial

## Estado: no integrada (decisión consciente)

No hay ningún modelo de lenguaje integrado. Lo que existe hoy, y funciona:

- `POST /ai/recommend`, `/ai/substitute` y `/ai/explain` en la API, con un **motor de reglas**
  sobre contenido verificado, que lo declara en cada respuesta (`engine: "RULES"`, `llm: false`)
  ([ADR-0007](../adr/0007-asistente-sin-llm.md)).
- En la app, las mismas capacidades sin conexión: "¿Qué puedo preparar?" con sustituciones
  aprobadas y explicadas, y la Escuela de técnicas.

## Por qué no se integró un LLM

1. **Gratuidad:** los modelos de lenguaje alojados cobran por uso. Integrar uno introduciría la
   "dependencia de servicios pagos" que el documento pide evitar, o exigiría límites artificiales.
2. **Offline:** la app debe funcionar sin conexión, y un LLM en la nube no lo hace.
3. **Reglas:** el documento prohíbe que la IA modifique el algoritmo de coincidencia; el diseño
   actual ya lo garantiza.

## Si se decide integrarlo

Un proveedor opcional detrás de una interfaz, desactivado por defecto, que solo **redacte**
explicaciones sobre los resultados del motor y el contenido verificado. Sin proveedor configurado,
todo sigue funcionando igual. Requiere elegir proveedor y quién asume el costo: es una decisión del
dueño del producto.
