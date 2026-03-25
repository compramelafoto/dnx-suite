# Implementación de Interfaz Visual - ComprameLaFoto

## ✅ Completado

Se ha implementado toda la interfaz visual del flujo de pedido de impresiones fotográficas, inspirada en el estilo Squarespace.

## 📦 Instalación de Dependencias

Antes de ejecutar el proyecto, necesitás instalar las dependencias faltantes:

```bash
npm install clsx tailwind-merge
```

## 🎨 Estructura Implementada

### Componentes Base (`components/`)

- **Layout:**
  - `Header.tsx` - Header con logo y fondo gris oscuro
  - `MainLayout.tsx` - Layout principal que envuelve todas las páginas

- **UI:**
  - `Button.tsx` - Botones primary/secondary
  - `Card.tsx` - Cards reutilizables
  - `Input.tsx` - Inputs de texto
  - `Select.tsx` - Selects/dropdowns

- **Photo:**
  - `UploadZone.tsx` - Zona de drag & drop para subir fotos
  - `PhotoCard.tsx` - Card individual de foto
  - `PhotoGrid.tsx` - Grid responsive de fotos

- **Order:**
  - `OrderItem.tsx` - Item individual del pedido con controles
  - `OrderSummary.tsx` - Resumen completo del pedido

### Pantallas Implementadas (`app/`)

1. **Home/Landing** (`/`)
   - Hero con fondo gris oscuro
   - CTA principal
   - 3 cards de beneficios

2. **Subida de Fotos** (`/imprimir`)
   - Zona de drag & drop
   - Grid de previews
   - Botón para continuar

3. **Configuración** (`/imprimir/configurar`)
   - Lista de fotos con controles individuales
   - Selectores de tamaño, acabado, cantidad y precio
   - Total estimado

4. **Resumen** (`/imprimir/resumen`)
   - Lista clara de items
   - Total destacado
   - Botón de confirmación

5. **Datos del Cliente** (`/imprimir/datos`)
   - Formulario con validación
   - Opción retiro/envío
   - Finalización del pedido

6. **Confirmación** (`/imprimir/confirmacion`)
   - Mensaje de éxito
   - Número de pedido
   - Información de próximos pasos

## 🎨 Paleta de Colores

- **Fondo oscuro:** `#2D2D2D`
- **Fondo claro:** `#F8F9FA`
- **Texto oscuro:** `#1A1A1A`
- **Texto secundario:** `#6B7280`
- **Acento naranja:** `#C27B3D`
- **Acento verde:** `#57B851`
- **Bordes:** `#E5E7EB`
- **Éxito:** `#10B981`
- **Error:** `#EF4444`

## 📱 Características

- ✅ Diseño responsive (mobile-first)
- ✅ Header sticky con logo
- ✅ Drag & drop para subir fotos
- ✅ Navegación entre pasos del flujo
- ✅ Validación de formularios
- ✅ Feedback visual en todas las acciones
- ✅ Estilo minimalista y premium

## 🚀 Próximos Pasos

1. Instalar dependencias: `npm install clsx tailwind-merge`
2. Ejecutar el servidor: `npm run dev`
3. Probar el flujo completo desde `/` hasta `/imprimir/confirmacion`

## 📝 Notas

- El estado se guarda en `sessionStorage` entre pasos
- Los precios por defecto están hardcodeados (se pueden conectar con la API de pricing)
- El logo debe estar en `/public/LOGO CLF.png`
