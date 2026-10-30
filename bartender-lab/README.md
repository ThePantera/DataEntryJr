# BARTENDER LAB

Aplicación gratuita de coctelería para bartenders profesionales, estudiantes y aficionados.
Este directorio contiene el monorepo del producto (API, dominio compartido y, desde la Fase 4,
la app móvil).

## Estado

| Fase | Contenido                         | Estado                                                                                        |
| ---- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| 1    | Repositorio y arquitectura        | ✅ ([detalle](docs/fases/fase-01.md))                                                         |
| 2    | Base de datos y migraciones       | ✅ ([detalle](docs/fases/fase-02.md))                                                         |
| 3    | API REST y documentación Swagger  | ✅ ([detalle](docs/fases/fase-03.md))                                                         |
| 4    | Aplicación móvil (Expo) y APK     | ✅ ([detalle](docs/fases/fase-04.md))                                                         |
| 5    | Catálogo inicial de ingredientes  | ✅ inicial, ampliable ([detalle](docs/fases/fase-05.md))                                      |
| 6    | Recetario y técnicas              | ✅ 7 clásicos IBA y 4 técnicas ([detalle](docs/fases/fase-06.md))                             |
| 7    | Inventario y buscador inteligente | ✅ ([detalle](docs/fases/fase-07.md))                                                         |
| 8    | SQLite y sincronización offline   | ✅ ([detalle](docs/fases/fase-08.md))                                                         |
| 9    | Modo preparación                  | ✅ ([detalle](docs/fases/fase-09.md))                                                         |
| 10   | Inteligencia artificial (LLM)     | ⛔ No integrada: el asistente usa reglas, gratis y offline ([detalle](docs/fases/fase-10.md)) |
| 11   | Testing, seguridad y optimización | 🟡 Parcial ([detalle](docs/fases/fase-11.md))                                                 |

**La app es gratuita y funciona sin servidor:** el APK trae el recetario incorporado. El servidor
(esta API) es opcional y solo hace falta para sincronizar entre dispositivos o descargar recetas
nuevas. Nada pendiente está simulado.

## Estructura

```
bartender-lab/
├── apps/
│   ├── api/                 API REST (NestJS 11 + Prisma 6 + PostgreSQL)
│   │   ├── prisma/          esquema, migraciones, catálogo inicial y seed
│   │   ├── src/             un módulo por dominio (auth, recipes, sync, …)
│   │   └── test/            pruebas unitarias (unit/) y e2e contra PostgreSQL (e2e/)
│   └── mobile/              app Expo / React Native (11 pantallas, barra inferior)
├── packages/
│   ├── shared/              dominio determinista (motor de coincidencia, escalado, enumeraciones)
│   └── client-core/         núcleo offline de la app: SQLite, catálogo incorporado,
│                            cola de operaciones y motor de sincronización
├── docs/
│   ├── arquitectura.md      visión técnica completa, incluido el protocolo de sincronización
│   ├── adr/                 registro de decisiones técnicas
│   ├── fases/               entrega, ejecución y pendientes de cada fase
│   └── api/openapi.json     contrato OpenAPI generado
└── docker-compose.yml       PostgreSQL local (desarrollo + pruebas)
```

## Requisitos

- Node.js 22 (ver `.nvmrc`) y npm 10.
- PostgreSQL 16. Con Docker: `npm run db:up` levanta uno con las bases `bartender_lab` y
  `bartender_lab_test`. Sin Docker, cualquier PostgreSQL 16 sirve (también Supabase).

## Puesta en marcha

```bash
cd bartender-lab
npm ci
npm run db:up                                  # o usar un PostgreSQL propio
cp apps/api/.env.example apps/api/.env         # y poner un JWT_ACCESS_SECRET aleatorio
npm run db:deploy -w @bartender-lab/api        # aplica las migraciones
npm run db:seed -w @bartender-lab/api          # catálogo de desarrollo (idempotente)
npm run build
npm run start -w @bartender-lab/api            # http://localhost:3000/api/v1
```

- Swagger UI: <http://localhost:3000/api/docs> · JSON: <http://localhost:3000/api/docs-json>
- Salud: `GET /api/v1/health`
- Desarrollo con recarga: `npm run start:dev -w @bartender-lab/api`
- Administrador inicial: definir `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` (≥ 12 caracteres)
  en `apps/api/.env` y volver a ejecutar el seed.

## App móvil (APK)

```bash
npm run apk -w @bartender-lab/mobile     # requiere JDK 17+ y ANDROID_HOME → apps/mobile/dist/bartender-lab.apk
```

También la genera el workflow `bartender-lab-apk` de GitHub Actions (artefacto descargable).
Instalación: [docs/movil/instalar-apk.md](docs/movil/instalar-apk.md).

## Pruebas y calidad

```bash
npm run lint            # ESLint
npm run format:check    # Prettier
npm run typecheck       # TypeScript estricto
npm test                # unitarias (shared, client-core y API), sin base de datos
npm run test:e2e        # e2e contra PostgreSQL real (base bartender_lab_test)
```

Totales actuales: 106 unitarias (26 `shared`, 26 `client-core`, 54 API), 148 e2e (API y núcleo
móvil contra la API real) y la prueba de humo de la interfaz (`npm run smoke:web -w
@bartender-lab/mobile`).

Las pruebas e2e usan `DATABASE_URL` de `apps/api/.env.test` (ver `.env.test.example`) o, por
defecto, `bartender_lab_test` en `localhost`. **Vacían la base**, así que se niegan a ejecutarse
si su nombre no termina en `_test`.

La integración continua (`.github/workflows/bartender-lab.yml` en la raíz del repositorio)
ejecuta todo lo anterior contra un PostgreSQL 16 de servicio.

## Scripts de la API

| Script             | Qué hace                                                                           |
| ------------------ | ---------------------------------------------------------------------------------- |
| `db:migrate`       | Crea y aplica una migración nueva en desarrollo (`prisma migrate dev`).            |
| `db:deploy`        | Aplica las migraciones pendientes (producción/CI).                                 |
| `db:seed`          | Inserta el catálogo de desarrollo si falta; nunca sobrescribe cambios editoriales. |
| `manifest:rebuild` | Recalcula el manifiesto de descargas desde las tablas de contenido.                |
| `openapi:export`   | Regenera `docs/api/openapi.json` (una prueba e2e exige que esté al día).           |

## Documentación

- [Arquitectura](docs/arquitectura.md)
- [Decisiones técnicas (ADR)](docs/adr/README.md)
- Fases: [1](docs/fases/fase-01.md) · [2](docs/fases/fase-02.md) · [3](docs/fases/fase-03.md) ·
  [4](docs/fases/fase-04.md) · [5](docs/fases/fase-05.md) · [6](docs/fases/fase-06.md) ·
  [7](docs/fases/fase-07.md) · [8](docs/fases/fase-08.md) · [9](docs/fases/fase-09.md) ·
  [10](docs/fases/fase-10.md) · [11](docs/fases/fase-11.md)
- [Instalar el APK](docs/movil/instalar-apk.md)
