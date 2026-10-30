# Fase 11: Testing, seguridad y optimización

## Hecho

- CI en GitHub Actions: lint, formato, typecheck, build, unitarias, e2e contra PostgreSQL 16 y
  prueba de humo de la interfaz en navegador (`bartender-lab.yml`), y build del APK publicado como
  artefacto (`bartender-lab-apk.yml`).
- Mínimo privilegio en Android: se bloquean los permisos que la app no usa (almacenamiento externo,
  superposición de ventanas, biometría). Quedan Internet, estado de red y vibración (temporizador).
- Seguridad revisada en las Fases 3 y 8: scrypt, refresh tokens rotados con detección de
  reutilización, rol releído en cada petición, validación estricta, rate limiting, Helmet, errores
  sin datos sensibles en respuestas ni logs, tokens del móvil en el almacén seguro del sistema y
  aislamiento entre usuarios probado.

## Pendiente (no implementado)

| Tarea                                                                          | Motivo                                                                                   |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Pruebas automatizadas de interfaz de la app (Jest + Testing Library o Maestro) | La lógica está probada en `client-core`; la UI solo se verifica con typecheck y build.   |
| Purga periódica de `sync_operations` (más de 30 días)                          | Crecimiento de la tabla con el uso.                                                      |
| Rate limiting compartido entre instancias                                      | Solo necesario con varias instancias de la API.                                          |
| Clave de publicación propia y build para Google Play (AAB)                     | Requiere una cuenta y una clave del dueño del proyecto.                                  |
| Actualizar a NestJS 12, Prisma 7+, TypeScript 7 y Expo SDK más reciente        | [ADR-0002](../adr/0002-versiones-del-stack.md) y [ADR-0011](../adr/0011-expo-sdk-54.md). |
| Subida de imágenes (Supabase Storage u otro)                                   | Las entidades solo guardan URLs.                                                         |
