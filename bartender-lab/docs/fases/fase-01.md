# Fase 1: Repositorio y arquitectura

## Entregado

- Monorepo `bartender-lab/` con npm workspaces: `apps/api` y `packages/shared`
  ([ADR-0001](../adr/0001-monorepo-y-dominio-compartido.md)).
- TypeScript estricto compartido (`tsconfig.base.json`), ESLint 10 + typescript-eslint,
  Prettier y EditorConfig.
- `@bartender-lab/shared`: enumeraciones del dominio, **motor de coincidencia** y **escalado de
  cantidades**, como funciones puras listas para usarse offline en la app.
- `docker-compose.yml` con PostgreSQL 16 (bases de desarrollo y de pruebas).
- Integración continua en `.github/workflows/bartender-lab.yml` (raíz del repositorio): lint,
  formato, typecheck, build, pruebas unitarias y e2e con PostgreSQL de servicio.
- Documentación de [arquitectura](../arquitectura.md) y [registro de decisiones](../adr/README.md).

## Cómo ejecutar

```bash
cd bartender-lab
npm ci
npm run lint && npm run format:check
npm test -w @bartender-lab/shared
```

## Pruebas

`packages/shared/test`: 26 pruebas.

- Escalado: redondeo por unidad (0,5 ml, ⅛ oz, unidades enteras), nunca a cero, `TOP_UP` sin
  cantidad, validación de porciones.
- Coincidencia: las tres clasificaciones, opcionales que no cuentan, sustituciones específicas y
  globales, sustituto que ya es ingrediente, no encadenamiento, determinismo ante el orden de
  entrada y orden del resultado.

## Decisiones

[ADR-0001](../adr/0001-monorepo-y-dominio-compartido.md) ·
[ADR-0002](../adr/0002-versiones-del-stack.md) ·
[ADR-0009](../adr/0009-pruebas-contra-postgresql.md)

## Pendiente para fases posteriores

- `apps/mobile` (Expo) se crea en la Fase 4 dentro del mismo workspace.
