# Accesibilidad — Auth DNX

## Mínimo obligatorio

- Navegación completa con teclado  
- Foco visible en controles y ojito  
- Labels reales (`<label htmlFor>`)  
- `aria-describedby` para helper/error  
- Contraste suficiente (texto / primary / error)  
- Errores asociados al campo o `role="alert"` en form error  
- Compatible con lector de pantalla  
- Área táctil ≥ 44px (CTA, Google, ojito)  
- Zoom móvil sin romper layout  
- No depender solo del color  
- Tab order = orden visual  

## Ojito

- Siempre con `aria-label` / `aria-pressed`  
- En el flujo de tabulación (botón después del input del mismo campo)  
- No solo icono decorativo  

## Google

- Enlace/botón con texto visible “Continuar con Google”  
- Estado `aria-busy` al redirigir  
- No disfrazar como único CTA en apps email-first  

## Validación

Incluir en rollout Fase 4: axe o equivalente + prueba manual teclado en login/registro/forgot/reset por app.
