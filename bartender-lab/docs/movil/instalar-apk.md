# Instalar el APK de Bartender Lab en Android

1. Copia `bartender-lab.apk` al teléfono (descarga, cable, Drive, etc.).
2. Ábrelo desde el teléfono. Android pedirá permiso para **instalar apps de origen desconocido**
   para la app con la que lo abriste (navegador, Archivos…): actívalo y vuelve atrás.
3. Pulsa **Instalar**. Requiere Android 7.0 o superior.
4. Abre **Bartender Lab**. El recetario, las técnicas, Mi barra, favoritos, listas de compras y el
   modo preparación funcionan **sin internet y sin cuenta**.

Notas:

- Google Play Protect puede advertir que la app no viene de la tienda; es normal en APKs
  instalados a mano. La app solo usa Internet (opcional, para sincronizar), el estado de la red y
  la vibración del temporizador; no pide permisos peligrosos.
- Sincronizar entre dispositivos o descargar recetas nuevas es opcional: requiere poner en marcha
  la API (ver el [README](../../README.md)) e indicar su dirección en **Más → Configuración**.
- Si una versión futura no se instala encima de la actual, desinstala la anterior antes
  ([ADR-0013](../adr/0013-distribucion-apk.md)). Desinstalar borra los datos locales que no se hayan
  sincronizado.
