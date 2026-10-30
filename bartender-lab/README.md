# BARTENDER LAB

Aplicación gratuita de coctelería para bartenders profesionales, estudiantes y aficionados.
Este directorio contiene el monorepo del producto (API, dominio compartido y, desde la Fase 4,
la app móvil).

## Estado

| Fase | Contenido                                   | Estado                                                             |
| ---- | ------------------------------------------- | ------------------------------------------------------------------ |
| 1    | Repositorio y arquitectura                  | ✅ Entregada ([detalle](docs/fases/fase-01.md))                    |
| 2    | Base de datos y migraciones                 | ✅ Entregada ([detalle](docs/fases/fase-02.md))                    |
| 3    | API REST y documentación Swagger            | ✅ Entregada ([detalle](docs/fases/fase-03.md))                    |
| 4    | Aplicación móvil (Expo)                     | ⏳ Pendiente                                                       |
| 5    | Catálogo inicial de ingredientes            | ⏳ Pendiente (hay un seed de desarrollo, no el catálogo editorial) |
| 6    | Recetario y técnicas                        | ⏳ Pendiente (la API ya los soporta; falta contenido y app)        |
| 7    | Inventario y buscador inteligente en la app | ⏳ Pendiente (endpoints listos)                                    |
| 8    | SQLite y sincronización offline en la app   | ⏳ Pendiente (protocolo y servidor listos)                         |
| 9    | Modo preparación                            | ⏳ Pendiente                                                       |
| 10   | Inteligencia artificial (LLM)               | ⏳ Pendiente (hoy el asistente usa reglas, sin LLM)                |
| 11   | Testing, seguridad y optimización           | ⏳ Pendiente                                                       |

Nada de lo marcado como pendiente está simulado: esos endpoints o pantallas simplemente no existen todavía.

## Estructura

```
bartender-lab/
├── apps/
│   └── api/                 API REST (NestJS 11 + Prisma 6 + PostgreSQL)
│       ├── prisma/          esquema, migraciones y seed de desarrollo
│       ├── src/             un módulo por dominio (auth, recipes, sync, …)
│       └── test/            pruebas unitarias (unit/) y e2e contra PostgreSQL (e2e/)
├── packages/
│   └── shared/              dominio determinista compartido con la app móvil
│                            (motor de coincidencia, escalado de cantidades, enumeraciones)
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

## Pruebas y calidad

```bash
npm run lint            # ESLint
npm run format:check    # Prettier
npm run typecheck       # TypeScript estricto
npm test                # unitarias (shared + API), sin base de datos
npm run test:e2e        # e2e contra PostgreSQL real (base bartender_lab_test)
```

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
- Fases: [1](docs/fases/fase-01.md) · [2](docs/fases/fase-02.md) · [3](docs/fases/fase-03.md)
