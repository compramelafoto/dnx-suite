# Checklist — Auth para nuevas aplicaciones DNX

Obligatorio antes de release Staging:

1. [ ] Usar `@repo/auth` para identidad (no User local).  
2. [ ] Crear `DnxAuthBrandConfig` en `@repo/auth-ui` (o extender brand/).  
3. [ ] Pantallas con `DnxLoginPanel` / Register / Forgot / Reset (o primitives + slots canónicos).  
4. [ ] Importar `tokens.css` y mapear `data-brand`.  
5. [ ] CTAs: “Iniciar sesión”, “Crear cuenta”, “Continuar con Google”.  
6. [ ] `sanitizeReturnTo` en redirects.  
7. [ ] Mensajes `DNX_AUTH_MESSAGES`.  
8. [ ] Google **después** del CTA email.  
9. [ ] Ojito vía `DnxPasswordField`.  
10. [ ] `pnpm auth:architecture:check` PASS.  
11. [ ] `pnpm auth:ui:architecture:check` sin errors.  
12. [ ] No deploy Production sin identidad compartida verificada.  
