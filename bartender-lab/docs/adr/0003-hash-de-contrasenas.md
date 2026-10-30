# ADR-0003: Contraseñas con scrypt de la biblioteca estándar

**Estado:** aceptada · **Fase:** 3

## Contexto

El documento exige no almacenar contraseñas en texto plano. Las opciones habituales son argon2id,
scrypt y bcrypt.

## Decisión

Se usa **scrypt** de `node:crypto` con N = 2¹⁷, r = 8, p = 1 y sal aleatoria de 16 bytes; son los
parámetros mínimos que recomienda OWASP para scrypt. El formato almacenado es
`scrypt$<log2 N>$<r>$<p>$<sal>$<hash>`. Los parámetros viajan con el hash, así que el coste puede
subir más adelante sin invalidar las contraseñas existentes. La comparación usa `timingSafeEqual`, y
el login verifica contra un hash señuelo cuando el email no existe, para que el tiempo de respuesta no
revele qué emails están registrados.

## Alternativas descartadas

- **argon2id** (la primera opción de OWASP): requiere un módulo nativo, con binarios por
  plataforma, que complica la CI y los contenedores. Es una mejora futura razonable, y el formato
  con prefijo permite convivir con ambos algoritmos.
- **bcrypt**: trunca las contraseñas a 72 bytes y también es nativo.

## Consecuencias

- Coste medido en el contenedor de desarrollo: ~470 ms y 128 MiB por hash con N = 2¹⁷. libuv
  limita la concurrencia a 4 hilos (~512 MiB de pico); el rate limit de `/auth/*` acota el abuso.
- `PASSWORD_HASH_COST` permite bajar el coste en desarrollo y pruebas (mínimo 10). En producción la
  configuración se rechaza al arrancar si es menor que 17.
