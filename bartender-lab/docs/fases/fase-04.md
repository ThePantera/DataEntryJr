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

La lógica de la app está en `packages/client-core` (ver [Fase 8](fase-08.md)). La interfaz se
verifica con typecheck estricto, el empaquetado de Metro (`expo export`), `expo install --check` y
el build del APK. No hay pruebas automatizadas de interfaz (pendiente en la Fase 11).

## Decisiones

[ADR-0010](../adr/0010-app-offline-first-con-catalogo-incorporado.md) ·
[ADR-0011](../adr/0011-expo-sdk-54.md) · [ADR-0013](../adr/0013-distribucion-apk.md)
