# ADR-0001: Monorepo con npm workspaces y paquete de dominio compartido

**Estado:** aceptada · **Fase:** 1

## Contexto

El producto tiene backend (NestJS) y app móvil (Expo), ambos en TypeScript. El motor de coincidencia
y el escalado de cantidades deben dar el mismo resultado online (API) y offline (app con SQLite).
El repositorio `DataEntryJr` ya contenía otro proyecto, y el usuario pidió construir BARTENDER LAB
en una subcarpeta.

## Decisión

- Monorepo en `bartender-lab/` con **npm workspaces** (sin Nx ni Turborepo): `apps/api`,
  `packages/shared` y, desde la Fase 4, `apps/mobile`.
- `@bartender-lab/shared` contiene solo lógica pura y determinista: enumeraciones, motor de
  coincidencia y escalado. No depende de Node ni de React Native y se compila a CommonJS con `tsc`.
- Una prueba unitaria de la API comprueba que las enumeraciones de `shared` coinciden con las de
  Prisma.

## Alternativas descartadas

- **Repositorios separados:** obligaría a publicar `shared` en un registro y versionarlo a mano.
- **Duplicar el motor en la app:** dos implementaciones de reglas que el documento exige
  deterministas acabarían divergiendo.
- **Nx/Turborepo:** no aportan lo suficiente con dos o tres paquetes.

## Consecuencias

- `shared` debe compilarse antes que la API (los scripts `pretest`, `prebuild` y `pretypecheck` lo
  hacen solos).
- Para extraer el proyecto a su propio repositorio basta mover `bartender-lab/` y el workflow de CI.
