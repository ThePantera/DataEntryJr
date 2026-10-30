# Descargar Bartender Lab para Android

**[⬇️ Descargar bartender-lab.apk](https://github.com/ThePantera/DataEntryJr/raw/ccr-2626994a-i6y0qr/bartender-lab/apk/bartender-lab.apk)**

|         |                                                                    |
| ------- | ------------------------------------------------------------------ |
| Versión | 1.0.0                                                              |
| Android | 7.0 o superior                                                     |
| Tamaño  | 41 MB                                                              |
| SHA-256 | `9bd7971cdd6a4ca915b10b923ba75ce8840a3953ca6177f3ad1c0fd6d30afc8e` |

Gratis, sin anuncios ni pagos. Funciona sin internet y sin cuenta.

## Cómo instalarla

1. Abre el enlace de arriba desde el teléfono y descarga el archivo.
2. Toca el archivo descargado.
3. Si Android lo pide, permite **instalar apps de origen desconocido** y vuelve atrás.
4. Toca **Instalar** y abre **Bartender Lab**.

Más detalles en [docs/movil/instalar-apk.md](../docs/movil/instalar-apk.md).

## Para quien mantiene el proyecto

Este archivo se reemplaza a mano en cada versión nueva:

```bash
npm run apk -w @bartender-lab/mobile
cp apps/mobile/dist/bartender-lab.apk apk/bartender-lab.apk
```

Actualiza también la versión y el SHA-256 de esta página (`sha256sum apk/bartender-lab.apk`).
