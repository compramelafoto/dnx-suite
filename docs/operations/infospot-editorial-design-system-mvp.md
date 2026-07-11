# Info Spot — Design System editorial MVP

## Identidad

- Medio digital argentino, luminoso, fotográfico
- Sin modo oscuro
- Acento naranja `#E85D04`
- Tipografía: Plus Jakarta Sans
- Slogan: “Descubrí lo que está pasando cerca tuyo.”

## Tokens (`app/globals.css`)

Colores, spacing 4–96, radios sm/md/lg, sombras mínimas, anchos:
- sitio 1280px
- editorial 1180px
- artículo 720px
- media 960px

## Componentes

Layout: `SiteContainer`, `EditorialContainer`, `ArticleBodyContainer`, `WideMediaContainer`, `Section`, `SiteHeader`, `MobileNavigation`, `SiteFooter`

Editorial: cards (Featured/Horizontal/Compact), badges, metadata, imágenes, share, related, newsletter placeholder, empty state, pagination

Brand: `InfoSpotLogo` + `/public/infospot-logo.svg` (placeholder alineado a marca naranja; reemplazar por logo aprobado final cuando esté el archivo)

## Páginas rediseñadas

`/`, `/noticias`, `/categorias/[slug]`, `/noticias/[slug]`, `/quienes-somos`, `/contacto`
