# Arquitectura de información — Auth DNX

## Login (orden obligatorio)

1. Identidad de plataforma (logo)  
2. Título  
3. Descripción breve  
4. Email  
5. Contraseña + ojito  
6. Fila auxiliar (olvidé mi contraseña; recordar sesión si aplica)  
7. Botón “Iniciar sesión”  
8. Error / estado  
9. Separador “o”  
10. “Continuar con Google”  
11. “Crear cuenta” (si aplica)  
12. Ayuda / invitación  
13. Términos y privacidad  

## Registro

1. Logo y contexto → 2. Título → 3. Nombre → 4. Apellido → 5. Email →  
6–7. Contraseña + repetir (ojito cada una) → 8. Requisitos → 9. Consentimientos →  
10. CTA → 11. Separador → 12. Google → 13. Ya tengo cuenta → 14. Legal  

No mezclar campos de producto (inscripción, categoría, organización).

## Forgot / Reset

Forgot: logo → título → explicación → email → enviar → mensaje neutro → volver.  
Reset: logo → título → nueva + ojito → repetir + ojito → requisitos → guardar → resultado.

## Post-login

1. Resolver memberships  
2. Resolver roles  
3. Resolver contexto (`returnTo` sanitizado)  
4. Redirigir o mostrar `DnxProfileSwitcher`  

El rol no es identidad.

## Contexto seguro

Avisos secundarios (“Estás iniciando sesión para…”) sin alterar el orden.  
Solo `returnTo` sanitizado (`sanitizeReturnTo` de `@repo/auth`).

## Navegación de headers

Copy unificado: “Iniciar sesión”, “Crear cuenta”, “Mi cuenta”, “Cerrar sesión”.  
Evitar Entrar / Acceder / Login / Ingresar salvo decisión editorial global documentada.
