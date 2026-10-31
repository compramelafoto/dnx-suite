# Portal de DNX Suite

Sitio estático de `www.dnx-suite.com`: presenta las herramientas de la suite y
lleva a la página de registro de cada una.

- `herramientas.mjs`: textos, colores y enlaces de cada herramienta. Es lo único
  que hay que tocar para cambiar contenido.
- `generar.mjs`: arma `public/index.html`, una página por herramienta y el
  `favicon.svg`. Después de editar los datos:

  ```bash
  node apps/portal/generar.mjs
  ```

  Las páginas generadas se suben al repo. Vercel no compila nada: sirve
  `public/` tal cual (ver `vercel.json`).
- `public/logos/`: logos de cada herramienta (`-claro` para fondo claro,
  `-oscuro` para fondo oscuro, `-icono` sólo el diafragma).
- `public/fuentes/`: League Spartan y Public Sans, locales (sin Google Fonts).

No tiene `package.json` a propósito: no entra en el workspace de pnpm ni en el
lockfile, así que no puede romper otras apps.

Cada herramienta tiene su propia cuenta; el portal no registra a nadie, manda a
la página de registro de cada una.
