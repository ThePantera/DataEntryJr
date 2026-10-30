# ADR-0013: Distribución como APK instalable

**Estado:** aceptada · **Fase:** 4

## Decisión

- APK **release** (JavaScript precompilado a bytecode Hermes, sin servidor de desarrollo) para
  `arm64-v8a` y `armeabi-v7a`, que cubren prácticamente todos los teléfonos Android actuales.
  Paquete `com.bartenderlab.app`, Android 7.0 (API 24) o superior.
- **Firma:** el APK se firma con la clave de desarrollo que genera el proyecto, lo normal para
  instalar a mano y probar. Para Google Play hace falta una clave de publicación privada que el
  dueño del proyecto debe generar y custodiar fuera del repositorio. No se versiona ninguna clave
  de publicación.
- **HTTP sin cifrar permitido** (`usesCleartextTraffic`), para poder conectar la app a un servidor
  propio en la red local (`http://192.168.x.x:3000`). La app avisa cuando la dirección no es
  `https://`. Para un servidor público debe usarse HTTPS.
- Generación reproducible: `npm run apk -w @bartender-lab/mobile` (requiere JDK 17+ y Android
  SDK), y el workflow `.github/workflows/bartender-lab-apk.yml` publica el APK como artefacto de
  GitHub Actions.

## Consecuencias

- Como la clave de desarrollo es de cada proyecto generado, una versión futura compilada en otra
  máquina puede requerir desinstalar la anterior antes de instalarla. Una clave de publicación
  propia lo resuelve.
