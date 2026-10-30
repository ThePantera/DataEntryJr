# Registro de decisiones técnicas (ADR)

Cada decisión que el documento técnico dejaba abierta, o en la que la implementación se aparta de él,
está registrada aquí con su contexto, sus alternativas y sus consecuencias.

| ADR                                                        | Decisión                                                             | Estado   |
| ---------------------------------------------------------- | -------------------------------------------------------------------- | -------- |
| [0001](0001-monorepo-y-dominio-compartido.md)              | Monorepo con npm workspaces y paquete de dominio compartido          | Aceptada |
| [0002](0002-versiones-del-stack.md)                        | NestJS 11, Prisma 6 y TypeScript 5.9 en lugar de las últimas mayores | Aceptada |
| [0003](0003-hash-de-contrasenas.md)                        | Contraseñas con scrypt de la biblioteca estándar                     | Aceptada |
| [0004](0004-autenticacion.md)                              | JWT de acceso corto + refresh tokens opacos rotados                  | Aceptada |
| [0005](0005-sincronizacion.md)                             | Protocolo de sincronización y reglas de conflicto                    | Aceptada |
| [0006](0006-motor-de-coincidencia.md)                      | Motor de coincidencia determinista y sustituciones documentadas      | Aceptada |
| [0007](0007-asistente-sin-llm.md)                          | Asistente con motor de reglas hasta la Fase 10                       | Aceptada |
| [0008](0008-flujo-editorial.md)                            | Flujo editorial y permisos por rol                                   | Aceptada |
| [0009](0009-pruebas-contra-postgresql.md)                  | Pruebas e2e contra PostgreSQL real                                   | Aceptada |
| [0010](0010-app-offline-first-con-catalogo-incorporado.md) | App offline-first con catálogo incorporado y servidor opcional       | Aceptada |
| [0011](0011-expo-sdk-54.md)                                | Expo SDK 54 (React Native 0.81) para la app móvil                    | Aceptada |
| [0012](0012-nucleo-cliente-independiente.md)               | Núcleo del cliente independiente de React Native                     | Aceptada |
| [0013](0013-distribucion-apk.md)                           | Distribución como APK instalable                                     | Aceptada |
