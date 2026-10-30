# ADR-0011: Expo SDK 54 (React Native 0.81) para la app móvil

**Estado:** aceptada · **Fase:** 4

## Contexto

En octubre de 2026 la última versión es Expo SDK 58. Hay que compilar el APK en este entorno con
garantías y usar las bibliotecas que pide el documento: Expo Router, expo-sqlite y TanStack Query.

## Decisión

Expo **SDK 54** (React Native 0.81.5, React 19.1, nueva arquitectura y Hermes), con las versiones
exactas que valida `expo install --check`:

| Uso                                    | Biblioteca                                                                          |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| Navegación con barra inferior          | expo-router 6                                                                       |
| Base local                             | expo-sqlite 16                                                                      |
| Tokens de sesión                       | expo-secure-store 15 (Keystore de Android); **nunca SQLite**                        |
| UUID del cliente                       | expo-crypto 15 (`randomUUID`)                                                       |
| Detectar reconexión                    | expo-network 8                                                                      |
| Pantalla encendida en modo preparación | expo-keep-awake 15                                                                  |
| Datos en la UI                         | @tanstack/react-query 5 (`networkMode: 'always'`, porque las consultas leen SQLite) |

Es la misma política que el [ADR-0002](0002-versiones-del-stack.md): versiones estables y bien
conocidas. Actualizar a un SDK más nuevo es una tarea de la Fase 11.

## Consecuencias

- `android/` se genera con `expo prebuild` (Continuous Native Generation) y no se versiona. La
  configuración nativa vive en `app.json` y en `expo-build-properties`.
- `@bartender-lab/shared` y `@bartender-lab/client-core` declaran `"react-native": "src/index.ts"`, y
  Metro compila su TypeScript directamente; la app no necesita compilarlos antes.
