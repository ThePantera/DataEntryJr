# ADR-0002: NestJS 11, Prisma 6 y TypeScript 5.9

**Estado:** aceptada · **Fase:** 1

## Contexto

En octubre de 2026 las últimas mayores son NestJS 12, Prisma 7/8 (8 todavía en RC) y
TypeScript 7 (compilador nativo). Hay que elegir versiones estables para un MVP mantenible.

## Decisión

| Paquete    | Versión | Motivo                                                                                                                                                                      |
| ---------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NestJS     | 11.x    | NestJS 12 se publica **solo como ESM**. Jest, `ts-jest` y la metadata de decoradores que usa la inyección de dependencias funcionan de forma probada con CommonJS en la 11. |
| Prisma     | 6.19.x  | Prisma 7 obliga a usar adaptadores de driver, `prisma.config.ts` y un nuevo generador; la 8 aún es RC. La 6 es estable y soporta todo lo que el modelo necesita.            |
| TypeScript | 5.9.x   | `ts-jest` y `typescript-eslint` todavía no soportan TypeScript 7.                                                                                                           |
| Node.js    | 22 LTS  | Incluye `process.loadEnvFile`, por lo que no hace falta `dotenv`.                                                                                                           |
| ESLint     | 10      | ESLint 9 ya no tiene soporte.                                                                                                                                               |
| Jest       | 30      | Versión actual soportada por `ts-jest` 29.4.                                                                                                                                |

## Consecuencias

- Prisma muestra un aviso de que `package.json#prisma` (la configuración del seed) quedará
  obsoleto en Prisma 7. Se migrará a `prisma.config.ts` al subir de versión.
- La actualización a NestJS 12, Prisma 7+ y TypeScript 7 es una tarea explícita de la Fase 11:
  requiere pasar a ESM y cambiar el runner de pruebas.
- Los scripts que arrancan Nest (`openapi:export`) se ejecutan sobre el código compilado, porque
  `tsx` (esbuild) no emite la metadata de decoradores. `tsx` solo se usa para scripts sin
  inyección de dependencias (seed y reconstrucción del manifiesto).
