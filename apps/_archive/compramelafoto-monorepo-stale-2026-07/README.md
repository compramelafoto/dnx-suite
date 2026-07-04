This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Import proveedores (CSV)

1. Copiar el CSV a `data/import/alboom_form_contacto_de_proveedores.csv`
2. Ejecutar: `npm run import:proveedores`

## Privacidad y cumplimiento AAIP

ComprameLaFoto cumple con la Ley 25.326 de Protección de Datos Personales (Argentina) y registros ante AAIP en las bases:

1. **Usuarios y Operaciones** – Cuentas, pedidos, fotos, logs.
2. **Marketing y Comunicaciones** – Opt-in, baja, unsubscribe 1-click.
3. **Biometría / Reconocimiento Facial** – Consentimiento explícito, control y borrado real.

### Rutas principales

- `/privacidad` – Política de privacidad.
- `/privacidad/solicitud` – Formulario ARCO (acceso, rectificación, supresión, ocultar foto, baja marketing, desactivar biometría).
- `/api/unsubscribe?token=XXX` – Baja de emails de marketing en 1 clic.
- `/admin/privacidad/solicitudes` – Panel admin de solicitudes ARCO.

### Marketing (opt-in)

- Checkbox “Quiero recibir novedades” en registro (no pre-tildado).
- Toggle en perfil (fotógrafo/cliente).
- Unsubscribe 1-click con token único en emails promocionales.

### Reconocimiento facial

- Modal de consentimiento antes de usar búsqueda por rostro.
- Botón “Desactivar búsqueda por rostro” en perfil.
- Borrado de plantillas en Rekognition al desactivar o al eliminar álbum (45 días).
- Cron `cleanup-expired-albums` elimina faceIds de Rekognition en álbumes vencidos.

### Contacto

- privacidad@compramelafoto.com

---

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
