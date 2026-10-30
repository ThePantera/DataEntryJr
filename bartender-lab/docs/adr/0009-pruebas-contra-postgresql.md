# ADR-0009: Pruebas e2e contra PostgreSQL real

**Estado:** aceptada · **Fase:** 1

## Decisión

- **Unitarias** (sin base de datos): motor de coincidencia, escalado, reglas de conflicto, flujo
  editorial, validación de configuración, hash de contraseñas y paridad de enumeraciones.
- **E2E** con Jest y Supertest contra el `AppModule` real, con el mismo pipeline HTTP que
  producción y una base PostgreSQL real (`bartender_lab_test`). Las migraciones se aplican con
  `prisma migrate deploy`, y cada suite vacía las tablas y carga sus propios fixtures.
- Las pruebas se niegan a ejecutarse si el nombre de la base no termina en `_test`.
- Sin mocks de Prisma: las restricciones únicas, los CHECK, las transacciones y la concurrencia
  (por ejemplo, el mismo `opId` enviado dos veces a la vez) solo se prueban de verdad contra la base.
- Una prueba compara el OpenAPI generado con `docs/api/openapi.json` para que la documentación no se
  desactualice.

## Consecuencias

- Hace falta un PostgreSQL para `npm run test:e2e` (docker compose localmente; servicio en la CI).
- Las suites e2e corren en serie (`--runInBand`) porque comparten la base.
