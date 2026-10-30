# Fase 9: Modo preparación

## Entregado

`app/preparar/[id].tsx`, pantalla completa:

- Mantiene la pantalla encendida (`expo-keep-awake`).
- Paso 0: checklist de ingredientes con las cantidades de las porciones elegidas en el detalle.
- Paso a paso con texto grande y barra de progreso.
- Temporizador con vibración al terminar: usa la duración del paso o, si no tiene, la duración
  típica de la técnica (batido 15 s, refrescado 30 s).
- Cierre con la decoración de la receta.

## Pruebas

El escalado que alimenta el checklist está probado en `shared` y `client-core`. La prueba de humo
web abre el modo preparación del Negroni y verifica que se muestra el checklist.
