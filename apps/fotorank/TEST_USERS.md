# Usuarios @fotorank.com — pruebas manuales

Contraseña común: **`123456`**.

- **Organizador, admin y participantes** → [`/login`](http://localhost:3000/login) (tabla `User`).
- **Jurados** → [`/jurado/login`](http://localhost:3000/jurado/login) (tabla `FotorankJudgeAccount`).

Tabla por cuenta (rol, qué probar, datos del fixture), comando de seed y nota sobre **scrypt**: ver **[`packages/db/README.md`](../../packages/db/README.md#usuarios-fotorankcom-testing-manual-en-fotorank)**.

```sh
# Desde la raíz del monorepo
pnpm --filter @repo/db db:seed
```

Tras el seed, la consola imprime un resumen con los emails y los slugs del concurso de prueba.
