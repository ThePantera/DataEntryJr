# Fase 4: Aplicación móvil

## Entregado

App Expo/React Native en `apps/mobile`, en modo oscuro, en español, con barra inferior de cinco
pestañas: **Inicio, Explorar, Buscar, Mi barra y Más**. Las 11 pantallas del documento técnico:

| #   | Pantalla            | Ruta                      | Contenido                                                                                                        |
| --- | ------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | Inicio              | `app/(tabs)/index.tsx`    | Cuántos cócteles puedes preparar con tu barra, accesos rápidos, recetario y estado de sincronización             |
| 2   | Mi barra            | `app/(tabs)/mi-barra.tsx` | Inventario con cantidad, unidad y "agotado"; añadir y quitar ingredientes                                        |
| 3   | Explorar cócteles   | `app/(tabs)/explorar.tsx` | Filtros por categoría, dificultad y clásico/original                                                             |
| 4   | Buscar recetas      | `app/(tabs)/buscar.tsx`   | Por nombre o ingrediente (sin acentos) y "¿Qué puedo preparar?" con el motor determinista                        |
| 5   | Detalle de receta   | `app/receta/[id].tsx`     | Escalado de porciones, vaso, hielo, método, decoración, alérgenos, pasos, favorito y añadir faltantes a la lista |
| 6   | Escuela de técnicas | `app/tecnicas/`           | Descripción, cómo se hace, equipamiento y errores comunes                                                        |
| 7   | Modo preparación    | `app/preparar/[id].tsx`   | Pantalla completa sin apagarse, checklist de ingredientes, paso a paso y temporizador con vibración              |
| 8   | Favoritos           | `app/favoritos.tsx`       | Recetas marcadas                                                                                                 |
| 9   | Lista de compras    | `app/compras/`            | Listas e ítems, marcar comprados y pasarlos a Mi barra                                                           |
| 10  | Configuración       | `app/configuracion.tsx`   | Servidor opcional, cuenta, sincronización manual y avisos de conflictos                                          |
| 11  | Descargas offline   | `app/descargas.tsx`       | Recetas guardadas, actualizaciones disponibles, retiradas y descarga de recetas del servidor                     |

## Cómo ejecutar

```bash
cd bartender-lab && npm ci
npm run typecheck -w @bartender-lab/mobile
npm run start -w @bartender-lab/mobile          # Expo (requiere un development build o un emulador)
npm run apk -w @bartender-lab/mobile            # APK instalable (JDK 17+, ANDROID_HOME)
```

Instalación en el teléfono: ver [instalar el APK](../movil/instalar-apk.md).

## Pruebas

- **Prueba de humo de la interfaz** (`npm run smoke:web -w @bartender-lab/mobile`): exporta la app
  real para web (react-native-web y SQLite en WebAssembly), recorre con Playwright las 11 pantallas
  y el selector de ingredientes, y ejecuta el flujo principal offline: añadir Gin, Campari y Vermut
  a Mi barra → "¿Qué puedo preparar?" muestra el Negroni como "Tienes todo". Falla ante cualquier
  error de página. Corre también en la CI.
  - Detectó un error real antes de entregar el APK: npm había instalado dos versiones de React
    (19.1.0 y 19.3.1), lo que rompe los hooks al iniciar. Se corrigió fijando `overrides` en el
    `package.json` raíz.
- La lógica de la app está en `packages/client-core` (ver [Fase 8](fase-08.md)).
- Además: typecheck estricto, empaquetado de Metro para Android, `expo install --check` y build del
  APK. No hay emulador Android en la CI, por lo que la prueba de interfaz se hace en navegador.

## Decisiones

[ADR-0010](../adr/0010-app-offline-first-con-catalogo-incorporado.md) ·
[ADR-0011](../adr/0011-expo-sdk-54.md) · [ADR-0013](../adr/0013-distribucion-apk.md)
