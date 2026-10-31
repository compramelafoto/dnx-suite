# Portal de DNX Suite

Sitio estático de `www.dnx-suite.com`: presenta las herramientas de la suite y
lleva a la página de registro de cada una.

- `herramientas.mjs`: textos, colores y enlaces de cada herramienta. Es lo único
  que hay que tocar para cambiar contenido.
- `generar.mjs`: arma `public/index.html` y una página por herramienta.
  Después de editar los datos:

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

DNX Suite todavía no tiene logo: el portal usa el nombre en texto y no tiene
ícono de pestaña hasta que haya uno.
