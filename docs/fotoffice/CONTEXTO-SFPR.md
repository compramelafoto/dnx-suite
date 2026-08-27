# FotoOffice aplicado a la SFPR

## 1. Objetivo

FotoOffice es una plataforma modular y multi-workspace destinada a administrar instituciones, asociaciones y espacios vinculados con la fotografía.

La Sociedad de Fotógrafos Profesionales de Rosario (SFPR) es el primer caso real de implementación, pero FotoOffice no debe quedar desarrollado exclusivamente para esa institución ni contener reglas hardcodeadas para ella.

El proyecto busca resolver cuatro problemas principales:

1. Reducir el trabajo administrativo repetitivo de la Comisión Directiva.
2. Centralizar socios, cuotas, credenciales, reservas, cursos, beneficios, comunicaciones y documentación institucional.
3. Dar mayor transparencia y trazabilidad a la gestión.
4. Aumentar el valor que recibe el socio mediante servicios, beneficios, actividades, espacios y oportunidades profesionales.

La idea central utilizada para presentar el proyecto fue:

> Menos administración repetitiva, más transparencia, más servicios y más tiempo para que la Comisión pueda hacer crecer la institución.

Los principales tipos de usuario son:

- Integrantes de la Comisión Directiva.
- Administradores del workspace.
- Personal autorizado.
- Socios.
- Equipo de comunicación institucional.
- Organizadores y responsables de cursos o eventos.
- Sponsors, empresas aliadas y proveedores, cuando corresponda.
- Superadministradores de FotoOffice.

FotoOffice debe separar claramente:

- La administración institucional.
- El portal del socio.
- La página web pública.
- Las funcionalidades compartidas de la plataforma.
- Las configuraciones particulares de cada workspace.

## 2. Alcance

### Incluido

El alcance funcional discutido para FotoOffice incluye:

1. Gestión de socios y padrón.
2. Importación y exportación de socios mediante CSV.
3. Normalización de DNI, CUIT y CUIL.
4. Estados y categorías de socios.
5. Cuenta corriente de cada socio.
6. Cobro de cuotas.
7. Integración con Mercado Pago.
8. Pago mensual.
9. Pago anual anticipado con bonificación.
10. Fee de FotoOffice o Super Admin sobre las operaciones.
11. Carnets y credenciales digitales.
12. Usuarios, autenticación e invitaciones.
13. Vinculación segura entre un socio y un usuario.
14. Portal exclusivo del socio.
15. Panel administrativo separado del portal.
16. Página web pública de cada institución.
17. Website Builder.
18. Blog, novedades y contenidos públicos.
19. Reservas de salón, estudio y otros espacios.
20. Coworking.
21. Laboratorio fotográfico.
22. Streaming.
23. Cursos y actividades educativas.
24. Tienda y merchandising.
25. Eventos institucionales.
26. Beneficios y convenios para socios.
27. Sponsors y empresas aliadas.
28. Integración futura con DNX Partners.
29. Base global reutilizable de empresas.
30. Tesorería.
31. Facturas y comprobantes.
32. Cierres y reportes anuales.
33. Gobierno institucional.
34. Proyectos presentados por socios o por la Comisión.
35. Orden del día.
36. Votaciones internas.
37. Actas digitales.
38. Archivo institucional.
39. Auditoría y trazabilidad.
40. Comunicación institucional.
41. Equipo interno de comunicación.
42. Automatización de piezas de comunicación.
43. Bienvenida automática a nuevos socios.
44. Comunicación automática de nuevos beneficios y sponsors.
45. Firma institucional de emails por workspace.
46. Sorteos gratuitos para socios con cuota al día.
47. Sorteos con bono contribución.
48. Resultados de sorteos inmutables y auditables.
49. Muestras itinerantes.
50. Alianzas educativas.
51. Integración o beneficios particulares para estudiantes de ISET 18.
52. Red de recomendaciones profesionales tipo BNI.
53. Calificaciones y alertas dentro de esa red.
54. Subsidios y seguimiento de proyectos.
55. Portfolio.
56. Beneficios para clientes de fotógrafos en futuros workspaces individuales.
57. Modelo comercial de FotoOffice.
58. Presentación institucional del proyecto ante la Comisión Directiva.
59. Narrativa y materiales de presentación para personas no técnicas.
60. Implementación inicial específica para la SFPR.
61. Capacidad de reutilizar los módulos en otras asociaciones o workspaces.

El MVP discutido para la SFPR incluye prioritariamente:

1. Alta y gestión de socios.
2. Padrón.
3. Cobro de cuotas con Mercado Pago.
4. Carnets automáticos.
5. Portal del socio.
6. Usuarios e invitaciones.
7. Reservas de salón y estudio.
8. Página web pública.

La priorización definida posteriormente fue:

1. Socios, cobros y carnets automáticos al 100%.
2. Página web pública.
3. Inicio de sesión de Comisión Directiva y socios, respetando sus dependencias.
4. Diseño y blog de la página web.
5. Sponsors, beneficios y contratos mediante DNX Partners.
6. Sorteos con ruleta animada y resultado inmutable por socio y por mes.

### Explícitamente fuera de alcance

Quedaron explícitamente fuera de determinadas etapas o publicaciones:

1. Hardcodear FotoOffice exclusivamente para la SFPR.
2. Presentar DNX como marca protagonista ante la Comisión Directiva.
3. Mezclar el panel administrativo con el portal del socio.
4. Crear automáticamente un workspace para cualquier usuario que inicia sesión.
5. Crear `WorkspaceMembership` durante el flujo de activación de un socio.
6. Otorgar acceso antes de que el socio acepte explícitamente una invitación.
7. Vincular `Member.userId` al crear una cuenta sin contraseña.
8. Modificar globalmente `packages/auth` para resolver el regreso a una invitación.
9. Duplicar la generación de tokens de recuperación de contraseña.
10. Exponer tokens de invitación en el panel.
11. Registrar tokens de invitación en logs.
12. Mostrar al usuario cuerpos crudos o errores técnicos de Resend.
13. Presentar un email como enviado si el proveedor lo rechazó.
14. Ejecutar `prisma db push` en producción.
15. Revertir la migración aditiva del sistema de invitaciones durante un rollback de código.
16. Crear usuarios, invitaciones, membresías o workspaces durante smoke tests.
17. Enviar emails reales durante verificaciones previas al despliegue.
18. Usar staging o Preview cuando se indicó publicación directa de FotoOffice en producción.
19. Integrar inicialmente FotoOffice al despliegue general de DNX Partners. Esa exclusión fue temporal.
20. Implementar inmediatamente el módulo completo de comunicación interna. Se consideró uno de los últimos módulos, con posibilidad de desarrollarlo progresivamente.
21. Implementar el plan de ahorro para comprar cámaras con una mecánica semejante a una concesionaria.
22. Usar información interna o vocabulario técnico inexistente en emails destinados a socios.
23. Publicar nuevas funciones sin revisar migraciones, tests, build, rama, deployment y datos productivos.

PENDIENTE DE DEFINIR: alcance definitivo de la primera versión comercial de FotoOffice para instituciones distintas de la SFPR.

## 3. Contexto y estado actual

### 3.1 Producto y posicionamiento

FotoOffice se planteó como una plataforma modular multi-workspace.

La SFPR es el primer workspace real, pero la arquitectura debe permitir reutilizar los módulos en:

- Otras asociaciones de fotógrafos.
- Instituciones educativas.
- Espacios fotográficos.
- Workspaces de fotógrafos individuales.
- Organizaciones con socios, beneficios, cursos o reservas.

La base de empresas y sponsors se pensó como una base única para toda la plataforma. Cada workspace puede reutilizar una empresa en lugares y funciones diferentes.

Ejemplos discutidos:

- Una empresa puede aparecer como sponsor en placas y banners.
- Una empresa aliada puede ofrecer beneficios a los socios de una institución.
- Un fotógrafo con workspace propio podría ofrecer “Beneficios para mis clientes”, por ejemplo un descuento en un comercio para quienes contratan sus servicios.

La marca visible en la presentación institucional debe ser FotoOffice. DNX Suite puede existir como infraestructura o ecosistema, pero no debe dominar la narrativa dirigida a la Comisión Directiva.

Se documentó que el nombre FotoOffice ya estaba reservado o contemplado en componentes vinculados con:

- Identidad.
- Pagos.
- Partners.
- Notificaciones.
- Geolocalización.
- Recomendaciones.
- Design system.

PENDIENTE DE DEFINIR: convivencia definitiva entre las formas “fotoffice” y “fotooffice” en nombres técnicos, dominios y comunicación.

### 3.2 Presentación institucional

Se creó una presentación específica denominada:

`FotoOffice_SFPR_Presentacion_Proyecto.pptx`

La presentación se tituló conceptualmente:

> FotoOffice — Plataforma integral para la gestión y crecimiento de la SFPR

Su propósito era defender el proyecto ante la Comisión Directiva, no funcionar como documentación técnica.

La primera versión tenía aproximadamente 16 diapositivas e incluía:

- MVP.
- Alta de socios.
- Padrón.
- Cuotas.
- Mercado Pago.
- Credenciales.
- Reservas.
- Portal del socio.
- Beneficios.
- Modelo económico del 5%.
- Gobierno institucional.
- Automatizaciones.
- Etapas futuras.
- Cursos.
- Tienda.
- Coworking.
- Laboratorio.
- Portfolio.
- Red de oportunidades y recomendaciones tipo BNI.
- Necesidad de aprobaciones formales de la Comisión Directiva.

Posteriormente se consideró que 16 diapositivas resultaban insuficientes y se propuso una versión definitiva de aproximadamente 25 a 30 diapositivas.

La ampliación debía incorporar con mayor profundidad:

- Tesorería.
- Transparencia.
- Subsidios.
- Sponsors.
- Impacto institucional.
- Gobierno institucional.
- Proyectos de socios y Comisión Directiva.
- Orden del día.
- Votaciones.
- Actas.
- Archivo.
- Ecosistema con FotoRank y otras herramientas.
- Etapas de implementación.
- Beneficios concretos para socios.
- Beneficios concretos para la Comisión Directiva.
- Modelo económico y operativo.

También se habló de una presentación realizada o mostrada mediante Canva y de redactar nuevas propuestas surgidas después de esa presentación para explicárselas a Belén.

PENDIENTE DE DEFINIR: contenido exacto y archivo identificable de la presentación de Canva, porque en la información consolidada no aparece su nombre ni un identificador técnico.

PENDIENTE DE DEFINIR: cuáles de las propuestas surgidas después de la presentación de Canva quedaron formalmente aprobadas.

### 3.3 Estado de la aplicación

Se indicó que `apps/fotoffice` había sido restaurada con 156 archivos.

El puerto de desarrollo registrado fue:

`3010`

La directriz operativa definida para FotoOffice fue:

> Los despliegues de FotoOffice deben realizarse siempre a producción real, sin staging, salvo que posteriormente se autorice expresamente otra estrategia.

Se trabajó sobre la rama productiva:

`release/sponsor-global-technical-deploy`

El proyecto Vercel autorizado para FotoOffice fue:

- Nombre: `fotoffice-dnxsuite`
- ID: `prj_AUL05cB4eeBdtiidWcsC7bwUtHd5`

El flujo de invitaciones, portal del socio y activación fue publicado en producción con:

- SHA corto: `c07d6432`
- SHA completo: `c07d64329c16d834a0cb4237034e9ef312fb633d`
- Deployment: `dpl_GmCESEqPdyW7pGDNpeK5DGYrExpr`
- Target: `production`
- Estado: `READY`
- Build informado: 1 minuto

Los siete commits publicados, sobre `f0144189`, fueron:

| Commit | Contenido |
|---|---|
| `f9c188fd` | URL absoluta obligatoria, vigencia de 72 horas y migración |
| `f1acb838` | Fin del workspace fantasma en el login |
| `9299d067` | Portal del socio y frontera con el panel |
| `4b386afb` | Envío del email con auditoría |
| `b4110d80` | Activación con contraseña mediante continuidad propia |
| `f3539497` | Estados reales en la ficha y test integral |
| `c07d6432` | Gate del segundo email y actualización de `emailVerifiedAt` |

El cambio final comprendió:

- 33 archivos.
- `+2341 / −72`.
- Una sola migración.
- Cero modificaciones en `packages/auth`.
- Árbol limpio al momento del despliegue.

Los dominios asociados al deployment fueron:

- `fotoffice.com`
- `[www.fotoffice.com](https://www.fotoffice.com)`
- `fotoffice.com.ar`
- `[www.fotoffice.com.ar](https://www.fotoffice.com.ar)`
- `fotoffice-dnxsuite.vercel.app`

El deployment anterior identificado para rollback fue:

- Deployment: `dpl_84qi2wApHqKHF5DCoTpLwDUdX5zp`
- SHA: `f0144189`
- Estado: `READY`

Se informó que, después del deployment productivo, apareció un Preview:

`dpl_2uTz4Dts…`

Ese Preview:

- Provenía de otra rama.
- No fue creado ni promovido como parte de la publicación.
- Se canceló automáticamente a los 14 segundos.
- Fue detenido por `ignoreCommand`.
- No afectó el deployment productivo.

### 3.4 Variables de entorno y correo

Variables discutidas:

- `RESEND_API_KEY`
- `APP_URL`
- `EMAIL_FROM`
- `DNX_EMAIL_FROM`
- `FOTOFFICE_NOTIFICATIONS_FROM`

Configuración productiva verificada:

| Variable | Estado |
|---|---|
| `RESEND_API_KEY` | Existía y no fue modificada |
| `APP_URL` | Existía y su valor era exactamente `https://fotoffice.com` |
| `EMAIL_FROM` | Fue creada únicamente para Production |
| `DNX_EMAIL_FROM` | No existía |
| `FOTOFFICE_NOTIFICATIONS_FROM` | No fue modificada |

Valor configurado:

`EMAIL_FROM=FotoOffice <no-reply@mail.fotoffice.com>`

El dominio `mail.fotoffice.com` estaba verificado en Resend.

También estaban verificados:

- `maratonfotografica.com`
- `compramelafoto.com`

El fallback existente en el transporte de identidad era:

`DNX Suite <noreply@dnxsuite.com>`

Ese fallback no era utilizable para FotoOffice porque `dnxsuite.com` no estaba verificado en Resend y el proveedor habría rechazado el envío con 403.

Orden de resolución del remitente en `packages/auth/src/email.ts`:

1. `EMAIL_FROM`
2. `DNX_EMAIL_FROM`
3. `DNX Suite <noreply@dnxsuite.com>`

El enlace para crear contraseña se construye desde FotoOffice usando:

- `APP_URL`
- `appLabel: "FotoOffice"`
- `resetPath: "/recuperar"`

No debe apuntar a:

- ComprameLaFoto.
- Otra aplicación.
- `localhost`.
- Un dominio de fallback.

### 3.5 Validaciones productivas

Resultados finales informados antes de publicar:

| Verificación | Resultado |
|---|---|
| Suite FotoOffice | 657 tests pasan en 59 archivos |
| `packages/db` | 68 pasan, 0 fallan |
| `packages/auth` | No modificado |
| Typecheck | Idéntico al resultado de la base |
| Lint | 7 problemas preexistentes en tres archivos ajenos |
| `prisma validate` | Válido |
| Build | `exit 0` |

Smoke tests productivos:

| Ruta | Resultado |
|---|---|
| `/` | 200 |
| `/login` | 200 |
| `/workspace/configuracion` | 307 hacia `/login?next=…` |
| `/w/sfpr/cursos` | 200 |
| `/portal` | 307 hacia `/login` sin sesión |
| `/invitacion/xxx` | 200 con mensaje genérico de invitación inválida |
| Favicon | 200, `image/vnd.microsoft.icon`, 21.614 bytes |
| Dominios alternativos | 308 hacia el dominio canónico |

Mensaje validado para token inválido:

> Invitación no válida — este enlace no es válido o ya fue utilizado

No hubo respuestas 5xx.

### 3.6 Estado de datos productivos después de la migración

Conteos antes y después de la migración:

| Entidad o condición | Antes | Después |
|---|---:|---:|
| Socios | 152 | 152 |
| Socios vinculados mediante `Member.userId` | 0 | 0 |
| Workspaces | 7 | 7 |
| `WorkspaceMembership` | 5 | 5 |
| Invitaciones | 1 | 1 |
| Usuarios | 168 | 168 |
| Usuarios con `emailVerifiedAt` no nulo | 146 | 146 |
| Auditorías | 1 | 1 |

Se confirmó:

- Cero usuarios creados.
- Cero invitaciones nuevas.
- Cero membresías nuevas.
- Cero workspaces nuevos.
- Ningún `Member.userId` modificado durante migración o smoke tests.
- Ningún `emailVerifiedAt` modificado durante migración o smoke tests.
- Ningún socio alterado.
- Cero emails de FotoOffice enviados durante la publicación.

Los tres emails más recientes observados en Resend correspondían a ComprameLaFoto, pedidos `#2667`, y no al flujo de FotoOffice.

### 3.7 Primera prueba real pendiente

No se realizó la primera invitación real.

Se recomendó seleccionar primero un socio:

- `ACTIVE`.
- Con email válido.
- Con `Member.userId` igual a `null`.
- Sin invitación pendiente vigente.
- Con una dirección controlada explícitamente por Daniel.
- Sin cambiar arbitrariamente el email de un socio real.

Se identificaron dos recorridos diferentes:

1. Usuario existente:
   - Recibe invitación.
   - Inicia sesión.
   - Acepta.
   - Vincula su cuenta.

2. Usuario nuevo:
   - Recibe invitación.
   - Crea contraseña.
   - Inicia sesión.
   - Regresa a la invitación.
   - Acepta.
   - Se vincula.
   - Ingresa a `/portal`.

Se recomendó probar primero el caso de usuario nuevo porque valida la cadena más extensa.

Antes de elegir al candidato se pidió inspeccionar, en modo de solo lectura, la única `MemberInvitation` histórica existente.

## 4. Requisitos funcionales

1. FotoOffice debe admitir múltiples workspaces sin hardcodear comportamientos exclusivos para la SFPR.
2. Cada workspace debe poder tener su propia identidad visual, configuración y firma institucional.
3. La SFPR debe operar como el primer workspace real de FotoOffice.
4. El sistema debe permitir dar de alta, editar, consultar, importar y exportar socios.
5. El padrón debe conservar el número de socio correspondiente a cada persona.
6. Los socios deben poder clasificarse mediante categorías y estados.
7. Los documentos de 7 u 8 dígitos deben tratarse como DNI.
8. Los documentos de 10 u 11 dígitos deben tratarse como CUIT/CUIL.
9. Los registros marcados como tipo `OTR` que contengan CUIT o CUIL deben normalizarse como CUIT/CUIL.
10. El sistema debe detectar conflictos e inconsistencias antes de importar un padrón.
11. Los emails duplicados deben revisarse porque pueden corresponder a personas diferentes.
12. Cuando un matrimonio comparte email, debe poder resolverse dejando una persona sin email o asignando temporalmente una variante, según decisión explícita.
13. El sistema debe permitir exportar el padrón en CSV.
14. El padrón productivo de la SFPR debe mantenerse íntegro durante migraciones y despliegues.
15. La gestión de cuotas debe admitir pago mensual.
16. El socio debe poder pagar un año completo en cualquier mes.
17. El pago anual debe equivaler a diez cuotas y otorgar dos meses bonificados.
18. El sistema debe registrar la cuenta corriente del socio.
19. El módulo de cuotas debe integrarse con Mercado Pago.
20. El modelo futuro de pagos puede requerir split `1:N`.
21. El sistema debe contemplar un fee configurable por workspace y por módulo.
22. El fee predeterminado debe ser del 5%.
23. El fee debe poder sumarse al precio o descontarse del importe cobrado.
24. La primera implementación del fee debe aplicarse a las cuotas de socios.
25. El carnet debe poder generarse automáticamente a partir de la información del socio.
26. El carnet debe poder reflejar el estado institucional que corresponda.
27. El socio debe acceder mediante un portal separado del panel administrativo.
28. El panel administrativo debe permanecer restringido a usuarios autorizados.
29. Un socio no debe obtener acceso por el solo hecho de existir como `Member`.
30. La activación debe vincular explícitamente un `Member` con un `User`.
31. El acceso de un socio no debe crear automáticamente un workspace.
32. El acceso de un socio no debe crear un `WorkspaceMembership`.
33. La invitación debe poder enviarse solamente a socios `ACTIVE`.
34. La invitación debe usar el email propio y normalizado del socio.
35. Solamente `OWNER` o `ADMIN` deben poder invitar, reenviar o revocar.
36. Un usuario con rol `STAFF` no debe poder administrar invitaciones.
37. El panel debe mostrar el email destinatario de la invitación.
38. El panel debe mostrar la fecha de envío.
39. El panel debe mostrar la fecha de vencimiento.
40. El panel debe mostrar el estado derivado de la invitación.
41. El panel debe distinguir “Sin acceso”.
42. El panel debe distinguir “Invitación pendiente”.
43. El panel debe distinguir “Invitación vencida”.
44. El panel debe distinguir “Error de envío”.
45. El panel debe distinguir “Acceso activo”.
46. El panel debe distinguir “Invitación revocada” cuando corresponda.
47. El panel debe ofrecer el botón “Invitar a FotoOffice”.
48. El panel debe ofrecer el botón “Reenviar invitación”.
49. El panel debe ofrecer el botón “Revocar invitación”.
50. Reenviar una invitación debe generar un token nuevo e invalidar el anterior.
51. El token nunca debe mostrarse ni copiarse desde el panel.
52. Una invitación no debe mostrarse como enviada solamente porque fue creada.
53. El estado de envío exitoso debe requerir `sentAt`.
54. Un fallo de envío debe registrar `sendFailedAt`.
55. Un fallo debe dejar la invitación en condición reintentable.
56. El email de invitación debe incluir HTML y texto.
57. La firma del workspace debe agregarse una sola vez al email.
58. La firma no debe utilizar vocabulario interno ni mencionar funciones inexistentes.
59. La invitación debe tener una URL absoluta construida con `APP_URL`.
60. Si falta `APP_URL`, la invitación no debe crearse.
61. La vigencia prevista de la invitación debe ser de 72 horas.
62. El envío debe realizarse después de confirmar la transacción que crea la invitación.
63. La aceptación del proveedor debe actualizar `sentAt`.
64. El rechazo o error debe actualizar `sendFailedAt`.
65. Crear una invitación debe auditar `INVITE_CREATED`.
66. Enviar exitosamente debe auditar `INVITE_SENT`.
67. Reenviar exitosamente debe auditar `INVITE_RESENT`.
68. Fallar el envío debe auditar `INVITE_SEND_FAILED`.
69. Revocar debe auditar `INVITE_REVOKED`.
70. Aceptar debe auditar `INVITE_ACCEPTED`.
71. La vinculación entre usuario y socio debe conservar la auditoría `USER_LINKED`.
72. `INVITE_ACCEPTED` y `USER_LINKED` deben conservar semánticas diferentes.
73. Un usuario inexistente debe poder crear acceso mediante contraseña.
74. El usuario creado durante la activación debe tener `globalRole=USER`.
75. El usuario creado durante la activación no debe recibir sesión automáticamente.
76. El usuario creado durante la activación no debe recibir `WorkspaceMembership`.
77. El usuario creado durante la activación no debe quedar vinculado al `Member` antes de aceptar.
78. Si existe un usuario sin contraseña con el mismo email, debe reutilizarse.
79. Si existe un usuario con contraseña, no debe crearse otro y debe indicarse que inicie sesión.
80. La creación concurrente debe producir un solo `User`.
81. La cuenta sin contraseña debe crearse mediante un mecanismo idempotente, como `upsert`.
82. El sistema debe reutilizar `requestPasswordReset` como único generador del token de contraseña.
83. El sistema debe guardar la continuidad de la invitación en una cookie exclusiva de FotoOffice.
84. La cookie debe ser `HttpOnly`.
85. La cookie debe ser `Secure` en producción.
86. La cookie debe usar `SameSite=Lax`.
87. La cookie debe usar `Path=/`.
88. El `Max-Age` de la cookie no debe superar el tiempo restante de la invitación.
89. La cookie puede contener el token de invitación o un valor opaco suficiente para recuperarla.
90. La cookie nunca debe registrarse en logs.
91. La cookie nunca debe quedar accesible desde JavaScript.
92. La cookie debe eliminarse al aceptar.
93. La cookie debe eliminarse cuando la invitación esté vencida.
94. La cookie debe eliminarse cuando la invitación esté revocada.
95. La cookie debe eliminarse cuando la invitación sea inválida.
96. La cookie manipulada debe ignorarse y eliminarse.
97. La cookie expirada debe ignorarse.
98. La continuidad debe revisarse solamente después de autenticar al usuario.
99. El email de la sesión autenticada debe coincidir con el email invitado.
100. Un login con otro email no debe redirigir a la invitación.
101. Un login correcto debe regresar a `/invitacion/[token]`.
102. El regreso no debe consumir todavía la invitación.
103. El regreso no debe llamar a `ensureFotofficeWorkspaceForUser`.
104. Si el socio cambia de navegador o borra cookies, debe poder reabrir el enlace original mientras continúe vigente.
105. La aceptación debe ser explícita.
106. La aceptación debe ejecutarse transaccionalmente.
107. La aceptación debe protegerse contra doble aceptación.
108. La aceptación debe vincular `Member.userId` una sola vez.
109. La aceptación debe redirigir a `/portal`.
110. La aceptación debe actualizar `User.emailVerifiedAt` solamente si estaba en `null`.
111. Una fecha previa de `emailVerifiedAt` debe conservarse.
112. La aceptación no debe modificar el email del usuario.
113. La aceptación no debe modificar otro usuario.
114. El email no debe marcarse verificado al crear el usuario.
115. El email no debe marcarse verificado al solicitar la contraseña.
116. El email no debe verificarse si la invitación está vencida.
117. El email no debe verificarse si la invitación está revocada.
118. El email no debe verificarse si el `Member` no está `ACTIVE`.
119. El email no debe verificarse si el email autenticado no coincide.
120. El email no debe verificarse si se pierde una carrera de concurrencia.
121. El email debe verificarse dentro de la misma transacción de aceptación.
122. La UI nunca debe afirmar que se envió el email de contraseña si `emailResult` está ausente.
123. La UI solamente debe presentar éxito si `emailResult.sent === true`.
124. `emailResult.skipped === true` debe tratarse como falta de configuración.
125. `sent:false, skipped:false` debe presentarse como imposibilidad de enviar.
126. Un rechazo del proveedor y un error interno pueden mapearse al mismo mensaje genérico.
127. El campo `reason` del transporte no debe mostrarse ni registrarse.
128. El sistema debe permitir reintentar el email de contraseña para un usuario sin contraseña.
129. Un fallo del email de contraseña no debe vincular al socio.
130. Un fallo del email de contraseña no debe crear `WorkspaceMembership`.
131. La página web pública debe poder configurarse por workspace.
132. El Website Builder debe permitir gestionar el sitio público de la SFPR.
133. La web pública debe poder incorporar un blog.
134. Los socios deben poder reservar espacios habilitados por la institución.
135. El sistema debe contemplar inicialmente salón y estudio.
136. El sistema debe poder ampliarse a coworking, laboratorio y streaming.
137. El sistema debe permitir administrar cursos.
138. El sistema debe contemplar comunicaciones por email relacionadas con cursos.
139. La firma de email debe configurarse por workspace.
140. La firma debe poder utilizarse en HTML y texto.
141. La firma debe evitar duplicarse dentro de un mismo email.
142. El sistema debe permitir gestionar beneficios para socios.
143. Los beneficios deben poder asociarse con empresas de una base global.
144. Una empresa debe poder reutilizarse en múltiples workspaces y funcionalidades.
145. FotoOffice debe poder conectarse con DNX Partners cuando se autorice esa integración.
146. Los sponsors deben poder utilizarse en placas, logos, banners y beneficios.
147. El módulo institucional debe admitir proyectos de socios y de la Comisión.
148. Los proyectos deben poder tener una bandeja y estados.
149. Los temas deben poder incorporarse al orden del día.
150. Las votaciones deben admitir “a favor”, “en contra” y “abstención”.
151. El sistema debe poder generar o conservar actas digitales.
152. El archivo institucional debe permitir trazabilidad histórica.
153. La transparencia debe poder configurarse por niveles de acceso.
154. El seguimiento institucional debe conservar un historial que no pueda alterarse silenciosamente.
155. El módulo de comunicación debe notificar al equipo sobre sucesos relevantes.
156. La incorporación de un socio debe poder generar una propuesta de historia de bienvenida.
157. La incorporación de un sponsor debe poder generar una pieza sobre el nuevo beneficio o descuento.
158. El equipo de comunicación debe tener usuarios y permisos específicos.
159. El módulo de comunicación puede implementarse progresivamente.
160. Los sorteos gratuitos deben poder limitarse a socios con cuota al día.
161. Los sorteos deben mostrar una ruleta animada.
162. El resultado de cada sorteo debe ser inmutable y auditable.
163. Los sorteos con bono contribución deben tratarse separadamente de los sorteos gratuitos.
164. La red tipo BNI debe permitir recomendaciones entre integrantes.
165. La red debe contemplar calificaciones y alertas.
166. Las alianzas educativas deben poder aplicar beneficios particulares, como el 50% para estudiantes de ISET 18.
167. FotoOffice debe poder registrar subsidios y su seguimiento.
168. El sistema debe poder incorporar una tienda y merchandising en fases posteriores.
169. El sistema debe poder incorporar portfolios en fases posteriores.
170. El sistema debe poder incorporar muestras itinerantes en fases posteriores.
171. La presentación institucional debe explicar el producto en lenguaje no técnico.
172. La presentación institucional debe usar FotoOffice como marca visible.
173. La presentación debe explicar beneficios para la Comisión Directiva.
174. La presentación debe explicar beneficios para los socios.
175. La presentación debe explicar el modelo económico del 5%.
176. La presentación debe mostrar fases de implementación.
177. Las decisiones futuras no deben presentarse como funciones ya existentes.
178. Las funciones publicadas deben distinguirse de las implementadas localmente y de las ideas.
179. Claude Code debe verificar el estado real del repositorio y producción antes de asumir que los datos históricos continúan vigentes.
180. Ninguna modificación productiva debe ejecutarse sin autorización expresa.

## 5. Requisitos técnicos y restricciones

### 5.1 Aplicación, repositorio y despliegue

- Aplicación: `apps/fotoffice`
- Puerto de desarrollo: `3010`
- Proyecto Vercel: `fotoffice-dnxsuite`
- ID del proyecto: `prj_AUL05cB4eeBdtiidWcsC7bwUtHd5`
- Rama productiva: `release/sponsor-global-technical-deploy`
- Dominio canónico: `https://fotoffice.com`
- Deployment documentado: `dpl_GmCESEqPdyW7pGDNpeK5DGYrExpr`
- SHA documentado: `c07d64329c16d834a0cb4237034e9ef312fb633d`
- Rollback documentado: `dpl_84qi2wApHqKHF5DCoTpLwDUdX5zp`
- SHA de rollback: `f0144189`

El estado anterior debe considerarse histórico. Antes de nuevas modificaciones se debe verificar:

- Rama actual.
- `origin`.
- `HEAD`.
- Worktree.
- Commits pendientes.
- Migraciones.
- Deployment productivo.
- Conteos de la base.
- Variables de entorno.
- Dominios.
- Estado de Resend.

### 5.2 Base de datos y Prisma

Se usa Prisma.

Comandos y verificaciones exigidas:

- `prisma migrate status`
- `prisma migrate deploy`
- `prisma validate`

Restricción:

- Nunca utilizar `prisma db push` en producción.

Antes de ejecutar `prisma migrate deploy` se debe verificar que aparezcan solamente las migraciones esperadas. Si aparece una migración adicional no identificada, se debe frenar.

Las migraciones aditivas no deben revertirse automáticamente durante un rollback de código si:

- Solamente agregan valores a un enum.
- Solamente agregan columnas nullable.
- El código anterior ignora esos campos.

### 5.3 Autenticación

El sistema de identidad utiliza una tabla global `User`.

La autenticación existente se comparte con otras aplicaciones del monorepo.

Restricción principal:

- No modificar `packages/auth` sin una justificación explícita, análisis de compatibilidad y autorización previa.

Componentes mencionados:

- `packages/auth`
- `packages/auth/src/email.ts`
- `requestPasswordReset`
- `sendIdentityEmail`
- `createFotofficeSessionForUser`
- `ensureFotofficeWorkspaceForUser`

Comportamientos técnicos verificados:

- Un `User` sin contraseña no puede iniciar sesión.
- `identity.ts:312` corta el login antes de comparar la contraseña cuando no existe una válida.
- La sesión solamente nace mediante `createFotofficeSessionForUser`.
- `globalRole` predeterminado es `USER`.
- El panel exige `WorkspaceMembership`.
- `requestPasswordReset` construye la URL mediante el llamador y devuelve una respuesta anti-enumeración.
- `requestPasswordReset` puede devolver `ok: true` aunque no se haya enviado el email.
- El resultado real del envío se determina mediante `emailResult`.
- `sendIdentityEmail` devuelve `{sent, skipped, reason}`.
- `requestPasswordReset` puede omitir `emailResult` cuando el usuario no existe o está bloqueado.
- La ausencia de `emailResult` debe tratarse como fallo dentro de FotoOffice.

El flujo de FotoOffice no debe depender de un parámetro `next` agregado a `packages/auth`.

El flujo de recuperación existente finalizaba con una redirección fija a `/`, por lo que se implementó continuidad propia mediante cookie.

### 5.4 Variables de entorno

Variables relevantes:

`APP_URL`

Debe ser:

`https://fotoffice.com`

`EMAIL_FROM`

Valor productivo configurado:

`FotoOffice <no-reply@mail.fotoffice.com>`

Otras variables:

- `RESEND_API_KEY`
- `DNX_EMAIL_FROM`
- `FOTOFFICE_NOTIFICATIONS_FROM`

No se deben mostrar secretos.

No se debe modificar:

- `RESEND_API_KEY` sin necesidad.
- DNS sin autorización.
- Dominios de Resend sin autorización.
- Variables de otras aplicaciones.
- Variantes Preview o Development si el cambio fue autorizado solamente para Production.

### 5.5 Cookies y seguridad

Cookie sugerida:

`fotoffice_member_invitation`

Atributos obligatorios:

- `HttpOnly`
- `Secure` en producción
- `SameSite=Lax`
- `Path=/`
- `Max-Age` no superior al tiempo restante de la invitación

Modelo de amenaza corregido:

- `HttpOnly` impide leer el valor de la cookie desde JavaScript.
- `HttpOnly` no impide que un XSS del mismo origen ejecute solicitudes con la cookie adjunta.
- La seguridad decisiva depende de combinar:
  1. Sesión autenticada.
  2. Email coincidente.
  3. Token vigente.
  4. Confirmación explícita.
  5. Aceptación transaccional.

El token no debe aparecer en:

- Logs.
- Mensajes de error.
- HTML.
- URLs adicionales.
- Panel administrativo.

### 5.6 Rutas y endpoints

Rutas mencionadas:

- `/`
- `/login`
- `/workspace/configuracion`
- `/w/sfpr/cursos`
- `/portal`
- `/invitacion/[token]`
- `/invitacion/xxx`
- `/recuperar`
- `/recuperar/[token]`

Reglas:

- `/portal` debe redirigir a `/login` sin sesión.
- `/workspace/configuracion` debe redirigir al login sin sesión.
- `/invitacion/xxx` debe mostrar un mensaje genérico.
- El parámetro `next` debe ser interno y restringido a rutas seguras, especialmente dentro de `/portal`.
- No se debe permitir redirección abierta hacia dominios o rutas arbitrarias.

### 5.7 Validación requerida antes de publicar

Como mínimo:

1. Suite completa de FotoOffice.
2. Tests de `packages/db`.
3. Tests afectados de `packages/auth` si se modifica ese paquete.
4. Typecheck comparado con la base.
5. Lint de archivos modificados.
6. `prisma validate`.
7. Build de FotoOffice.
8. Inspección final del diff.
9. Verificación de migraciones pendientes.
10. Verificación de conteos antes y después.
11. Smoke tests sin efectos.
12. Verificación del SHA productivo.
13. Verificación del target `production`.
14. Verificación de dominios.
15. Identificación del rollback.

### 5.8 Restricciones operativas

No se debe:

- Hacer force push.
- Hacer squash no autorizado.
- Hacer merge no autorizado.
- Hacer rebase no autorizado.
- Crear un segundo deployment manual si el push ya genera Production.
- Promover un Preview sin autorización.
- Enviar emails reales durante QA técnico.
- Crear usuarios reales durante smoke tests.
- Crear invitaciones durante smoke tests.
- Aceptar invitaciones durante smoke tests.
- Crear workspaces durante smoke tests.
- Utilizar una ruta autenticada que genere datos durante smoke tests.
- Modificar socios para fabricar artificialmente un caso de prueba.
- Mostrar información personal completa durante una inspección de candidatos.

## 6. Arquitectura y componentes

### 6.1 Estructura conceptual

FotoOffice se divide en cuatro superficies principales:

1. Panel administrativo:
   - Utilizado por `OWNER`, `ADMIN` y personal autorizado.
   - Administra socios, cuotas, cursos, reservas, comunicaciones, beneficios y configuración.

2. Portal del socio:
   - Ruta principal: `/portal`.
   - Acceso exclusivo para socios vinculados.
   - No debe crear un workspace ni una membresía administrativa.

3. Sitio público:
   - Configurable por workspace.
   - Ejemplo: contenido público de la SFPR.
   - Incluye Website Builder, cursos, blog y otras páginas públicas.

4. Servicios compartidos:
   - Base de datos.
   - Autenticación.
   - Pagos.
   - Emails.
   - Partners.
   - Auditoría.
   - Diseño y composición.

### 6.2 Workspace

Cada institución utiliza un workspace.

El workspace debe centralizar:

- Branding.
- Socios.
- Usuarios administrativos.
- Firma de emails.
- Cursos.
- Reservas.
- Beneficios.
- Sponsors.
- Sitio público.
- Tesorería.
- Gobierno institucional.
- Configuración del fee.

La existencia de un `User` no implica que deba crearse un workspace.

La existencia de un `Member` no implica que deba crearse un `WorkspaceMembership`.

### 6.3 Separación entre `User`, `Member` y `WorkspaceMembership`

`User`:

- Identidad global del monorepo.
- Puede existir antes de estar vinculado a una institución.
- Puede autenticarse si cuenta con credenciales válidas.
- Tiene `globalRole`.
- Puede tener `emailVerifiedAt`.

`Member`:

- Representa a un socio dentro de un workspace.
- Contiene la información institucional.
- Puede tener `userId=null`.
- Se vincula a un `User` solamente al aceptar la invitación.

`WorkspaceMembership`:

- Representa acceso administrativo o pertenencia operativa a un workspace.
- No debe crearse para un socio común durante el flujo de invitación.
- Es requerido por el panel administrativo.

### 6.4 Flujo de invitación

Flujo administrativo:

1. `OWNER` o `ADMIN` abre la ficha del socio.
2. El sistema busca al socio dentro del workspace de la sesión.
3. Exige `Member` con estado `ACTIVE`.
4. Exige email propio y válido.
5. Resuelve una URL absoluta mediante `APP_URL`.
6. Si no existe configuración válida, no crea nada.
7. Dentro de una transacción:
   - Revoca invitaciones pendientes anteriores.
   - Crea la nueva invitación.
   - Registra `INVITE_CREATED`.
8. Fuera de la transacción:
   - Carga la firma del workspace.
   - Construye HTML y texto.
   - Envía el email.
9. Si el proveedor acepta:
   - Registra `sentAt`.
   - Audita `INVITE_SENT` o `INVITE_RESENT`.
10. Si el proveedor rechaza o falla:
    - Registra `sendFailedAt`.
    - Audita `INVITE_SEND_FAILED`.
    - Mantiene la posibilidad de reintentar.
    - No presenta el email como enviado.

### 6.5 Activación con contraseña

1. El socio abre `/invitacion/[token]`.
2. Elige crear acceso con contraseña.
3. FotoOffice vuelve a validar:
   - Token.
   - Vigencia.
   - Revocación.
   - Estado `ACTIVE`.
   - Email.
4. Si el `User` no existe:
   - Ejecuta `upsert`.
   - Crea un usuario sin contraseña.
   - Usa `globalRole=USER`.
   - No crea sesión.
   - No crea `WorkspaceMembership`.
   - No vincula `Member.userId`.
5. Si existe sin contraseña:
   - Reutiliza el usuario.
6. Si existe con contraseña:
   - Indica que debe iniciar sesión.
7. Guarda la continuidad en la cookie `fotoffice_member_invitation`.
8. Ejecuta `requestPasswordReset`.
9. Evalúa `emailResult`.
10. Solamente presenta éxito con `emailResult.sent === true`.

### 6.6 Regreso después de crear la contraseña

1. El socio establece su contraseña mediante `/recuperar/[token]`.
2. Inicia sesión.
3. FotoOffice revisa la continuidad después de autenticar.
4. Vuelve a validar la invitación.
5. Comprueba que el email autenticado coincide.
6. Redirige a `/invitacion/[token]`.
7. No consume la invitación.
8. No ejecuta `ensureFotofficeWorkspaceForUser`.
9. No crea `WorkspaceMembership`.

### 6.7 Aceptación

La aceptación debe realizarse en una transacción.

Secuencia:

1. Validar invitación.
2. Validar vigencia.
3. Validar revocación.
4. Validar estado `ACTIVE`.
5. Validar email.
6. Reclamar la invitación con protección contra concurrencia.
7. Vincular `Member.userId`.
8. Registrar `INVITE_ACCEPTED`.
9. Registrar `USER_LINKED`.
10. Ejecutar:

    await tx.user.updateMany({
      where: { id: userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: now },
    });

11. Eliminar la cookie.
12. Redirigir a `/portal`.

### 6.8 Transporte de email

Cadena del segundo email:

`sendIdentityEmail` → `requestPasswordReset` → `startPasswordActivationAction` → UI

Resultados:

| Desenlace | Detección | Mensaje funcional |
|---|---|---|
| Email aceptado | `emailResult.sent === true` | “Te enviamos un email…” |
| Configuración faltante | `emailResult.skipped === true` | “Falta configuración del sistema” |
| Proveedor rechazó | `sent:false, skipped:false` | “No pudimos enviarte el email” |
| Error interno | `sent:false, skipped:false` | “No pudimos enviarte el email” |
| Sin `emailResult` | Campo ausente | “No pudimos enviarte el email” |

El campo `reason` puede incluir hasta 120 caracteres del cuerpo crudo de Resend. Debe descartarse en la acción y nunca llegar a la UI o los logs.

### 6.9 Módulos institucionales

Los módulos se relacionan de esta manera:

- Socios alimenta cuotas, carnets, portal, sorteos, beneficios y comunicaciones.
- Cuotas determina estados financieros y elegibilidad para beneficios o sorteos.
- Usuarios e invitaciones conectan identidades globales con socios institucionales.
- Reservas consume socios, espacios y reglas de disponibilidad.
- Cursos consume socios, pagos, comunicaciones y web pública.
- Partners y beneficios consumen la base global de empresas.
- Gobierno institucional consume socios, autoridades, proyectos, votaciones y actas.
- Comunicación consume eventos de los demás módulos.
- Auditoría registra acciones sensibles.
- Website Builder publica información seleccionada del workspace.
- Tesorería consolida cuotas, cursos, alquileres, tienda y otros movimientos.

## 7. Modelo de datos / estructuras

### 7.1 Entidades mencionadas

#### `User`

Campos o propiedades mencionadas:

- `id`
- `email`
- contraseña o credencial equivalente
- `globalRole`
- `emailVerifiedAt`

Reglas:

- `globalRole` debe ser `USER` para un socio creado mediante invitación.
- `emailVerifiedAt` puede ser `null`.
- Debe actualizarse durante la aceptación si continúa en `null`.
- No debe modificarse una fecha existente.
- No debe cambiarse el email durante la aceptación.

#### `Member`

Campos o propiedades mencionadas:

- `userId`
- Estado, incluyendo `ACTIVE`
- Número de socio
- Email
- Documento
- Tipo de documento
- Categoría
- Workspace correspondiente

Reglas:

- `userId` puede ser `null`.
- `userId` se asigna solamente al aceptar.
- La aceptación debe impedir vinculación doble o concurrente.
- Solamente socios `ACTIVE` pueden iniciar el flujo.

#### `WorkspaceMembership`

Entidad separada de `Member`.

Reglas:

- No debe crearse durante activación o aceptación del socio.
- El panel administrativo depende de ella.
- No representa simplemente la condición de socio.

#### `MemberInvitation`

Campos mencionados:

- Token, cuyo hash es almacenado.
- `tokenHash`
- Estado derivado.
- Vigencia.
- Revocación.
- Aceptación.
- `sentAt`
- `sendFailedAt`
- Relación con `Member`.
- Relación con workspace.

Reglas:

- El token usa 32 bytes aleatorios.
- Se verifica contra su hash.
- `sentAt` es nullable.
- `sendFailedAt` es nullable.
- Reenviar invalida el token anterior.
- El token no se muestra.
- La invitación histórica preexistente debe inspeccionarse antes de la primera prueba real.

#### `FotofficeWorkspaceBranding`

Campo mencionado:

- `emailSignatureNote`, nullable.

Uso:

- Firma institucional por workspace.
- Salida HTML.
- Salida de texto.

#### `MemberAudit`

Entidad de auditoría.

Enum relacionado:

`MemberAuditAction`

Valores nuevos agregados:

- `INVITE_CREATED`
- `INVITE_SENT`
- `INVITE_RESENT`
- `INVITE_SEND_FAILED`
- `INVITE_REVOKED`
- `INVITE_ACCEPTED`

Valor existente relevante:

- `USER_LINKED`

### 7.2 Migración publicada

Migración única y aditiva:

    -- AlterEnum
    ALTER TYPE "MemberAuditAction" ADD VALUE 'INVITE_CREATED';
    ALTER TYPE "MemberAuditAction" ADD VALUE 'INVITE_SENT';
    ALTER TYPE "MemberAuditAction" ADD VALUE 'INVITE_RESENT';
    ALTER TYPE "MemberAuditAction" ADD VALUE 'INVITE_SEND_FAILED';
    ALTER TYPE "MemberAuditAction" ADD VALUE 'INVITE_REVOKED';
    ALTER TYPE "MemberAuditAction" ADD VALUE 'INVITE_ACCEPTED';

    -- AlterTable
    ALTER TABLE "MemberInvitation" ADD COLUMN     "sentAt" TIMESTAMP(3),
    ADD COLUMN     "sendFailedAt" TIMESTAMP(3);

Características:

- Sin backfill.
- Columnas nullable.
- Enum aditivo.
- Doce valores totales del enum después de la migración.
- Cero invitaciones históricas actualizadas con `sentAt`.
- Cero invitaciones históricas actualizadas con `sendFailedAt`.

### 7.3 Auditorías

Semántica:

| Acción | Significado |
|---|---|
| `INVITE_CREATED` | Se creó una invitación |
| `INVITE_SENT` | El proveedor aceptó el primer envío |
| `INVITE_RESENT` | El proveedor aceptó un reenvío |
| `INVITE_SEND_FAILED` | El envío falló o fue rechazado |
| `INVITE_REVOKED` | La invitación fue revocada |
| `INVITE_ACCEPTED` | El invitado aceptó explícitamente |
| `USER_LINKED` | `Member.userId` cambió de `null` a un usuario |

`INVITE_ACCEPTED` y `USER_LINKED` no son eventos duplicados porque representan hechos diferentes.

### 7.4 Formato de padrón

Se utilizó CSV para importar y exportar socios.

Reglas mencionadas:

- 7 u 8 dígitos: DNI.
- 10 u 11 dígitos: CUIT/CUIL.
- Tipo `OTR` con documento fiscal: normalizar a CUIT/CUIL.
- Emails duplicados deben revisarse.
- Las incompatibilidades no relevantes pueden desestimarse con autorización.
- La socia número 727 fue confirmada.
- Se agregaron números de socio 728, 729 y 730.

PENDIENTE DE DEFINIR: encabezado completo y definitivo del CSV, porque se mencionó que era fijo pero no quedó reproducido en esta conversación consolidada.

### 7.5 Estructuras futuras

Entidades o estructuras conceptuales todavía no detalladas completamente:

- Cuota.
- Cuenta corriente.
- Pago.
- Fee.
- Carnet.
- Espacio reservable.
- Reserva.
- Curso.
- Inscripción a curso.
- Beneficio.
- Empresa.
- Sponsor.
- Contrato.
- Proyecto institucional.
- Orden del día.
- Votación.
- Acta.
- Sorteo.
- Resultado de sorteo.
- Comunicación.
- Plantilla de comunicación.
- Subsidio.
- Recomendación tipo BNI.
- Calificación.
- Alerta.
- Tienda.
- Producto.
- Portfolio.
- Muestra.

PENDIENTE DE DEFINIR: modelos Prisma exactos de estos módulos cuando no estén ya implementados en el repositorio.

## 8. Decisiones tomadas

| Decisión | Motivo | Alternativa descartada |
|---|---|---|
| Usar FotoOffice como marca principal de la presentación | La Comisión debe comprender el producto institucional sin vocabulario interno | Presentar DNX Suite como protagonista |
| Implementar una arquitectura multi-workspace | La SFPR es el primer caso, no el único destino | Hardcodear la aplicación para la SFPR |
| Priorizar socios, cuotas y carnets | Constituyen el núcleo operativo y de valor inmediato | Empezar por módulos secundarios |
| Separar panel administrativo y portal del socio | Evita permisos indebidos y simplifica la experiencia | Usar el mismo acceso para Comisión y socios |
| No crear workspaces automáticamente al iniciar sesión | Un socio no debe convertirse en propietario o administrador | Mantener `ensureFotofficeWorkspaceForUser` en todos los logins |
| No crear `WorkspaceMembership` para socios comunes | `Member` y acceso administrativo representan conceptos diferentes | Convertir automáticamente cada socio en miembro administrativo |
| Vincular `Member.userId` solamente al aceptar | Evita otorgar acceso antes de confirmar identidad y voluntad | Vincular durante el envío o creación de cuenta |
| Mantener `User` como identidad global | Ya es el diseño compartido del monorepo | Crear una identidad aislada exclusiva de FotoOffice |
| Crear usuarios sin contraseña durante activación | Permite reutilizar el flujo existente de establecimiento de contraseña sin otorgar acceso | Crear contraseña directamente desde FotoOffice |
| Reutilizar `requestPasswordReset` | Evita duplicar tokens y lógica de identidad | Crear un generador paralelo de tokens |
| No modificar `packages/auth` para soportar `next` | El paquete es compartido y podía generar regresiones | Agregar `next` globalmente al flujo de recuperación |
| Usar una cookie propia de FotoOffice para continuidad | Permite regresar a la invitación sin modificar autenticación compartida | Incluir el retorno dentro del enlace de recuperación |
| Usar cookie `HttpOnly`, `Secure`, `SameSite=Lax` | Reduce exposición y limita el uso del token | Cookie accesible desde JavaScript |
| Revalidar después del login | La cookie por sí sola no debe otorgar acceso | Confiar solamente en la existencia de la cookie |
| Exigir coincidencia de email | Impide que otro usuario acepte la invitación | Aceptar con cualquier sesión autenticada |
| Exigir aceptación explícita | Distingue autenticación de consentimiento institucional | Vincular automáticamente después del login |
| Hacer la aceptación transaccional | Evita doble vinculación y estados parciales | Escribir cada cambio de manera independiente |
| Marcar `emailVerifiedAt` al aceptar | En ese punto se demostró control del email y coincidencia con la invitación | Marcarlo al crear el usuario o pedir contraseña |
| Conservar una fecha previa de verificación | No debe perderse información de identidad existente | Sobrescribir siempre `emailVerifiedAt` |
| Tratar la ausencia de `emailResult` como fallo | `requestPasswordReset` puede devolver `ok: true` sin enviar | Interpretar `ok: true` como prueba de envío |
| No exponer `reason` de Resend | Puede contener cuerpo crudo y datos técnicos | Mostrar detalles del proveedor al socio |
| Configurar `EMAIL_FROM=FotoOffice <no-reply@mail.fotoffice.com>` | `mail.fotoffice.com` estaba verificado | Usar el fallback `noreply@dnxsuite.com` |
| Mantener `APP_URL=https://fotoffice.com` | Garantiza enlaces absolutos correctos | Usar localhost, ComprameLaFoto o un fallback |
| Registrar `sentAt` y `sendFailedAt` | Permite diferenciar creación, envío y fallo reales | Inferir envío por la existencia de una invitación |
| Mantener auditorías separadas | Cada evento tiene significado propio | Usar una sola auditoría genérica |
| Usar migración aditiva sin backfill | Reduce riesgo sobre datos existentes | Reescribir invitaciones históricas |
| Aplicar migraciones con `prisma migrate deploy` | Es el flujo seguro y reproducible en producción | Utilizar `prisma db push` |
| Publicar FotoOffice directamente a producción | Fue una directriz explícita del proyecto | Usar staging por defecto |
| Hacer push fast-forward sin force, merge, squash o rebase | Preserva la serie de commits validada | Reescribir la historia |
| Mantener identificado un deployment de rollback | Permite volver al código anterior | Revertir apresuradamente la base |
| No revertir la migración aditiva durante rollback | El código anterior ignora columnas nullable y valores nuevos | Eliminar columnas o valores del enum |
| Usar base global de empresas | Permite reutilizar sponsors y aliados en distintos workspaces | Duplicar empresas por cada módulo |
| Excluir FotoOffice temporalmente del primer despliegue general de DNX Partners | Permitía avanzar gradualmente sin mezclar cambios | Integrarlo de inmediato a todo el despliegue de Partners |
| Permitir pago anual equivalente a diez cuotas | Incentiva el pago anticipado ofreciendo dos meses bonificados | Mantener únicamente pago mensual |
| Configurar fee predeterminado del 5% | Es el modelo económico definido para FotoOffice | No cobrar fee o fijarlo sin configuración |
| Permitir sumar o descontar el fee | Adapta el modelo a cada workspace y operación | Imponer una única modalidad |
| Implementar primero el fee sobre cuotas | Es el flujo principal del MVP | Aplicarlo simultáneamente a todos los módulos |
| Separar sorteos gratuitos y sorteos con bono contribución | Tienen reglas económicas y de elegibilidad diferentes | Usar un único tipo indiferenciado |
| Rechazar el plan de ahorro estilo concesionaria | Existía riesgo de que el adjudicatario recibiera el dinero y dejara de pagar | Implementar un plan de ahorro para comprar cámaras |
| Favorecer sorteos para socios al día y sorteos grandes para inversores | Se consideró más claro y controlable | Mantener el plan de ahorro |
| Tratar comunicación institucional como módulo progresivo | Es valioso pero no forma parte del núcleo inicial | Implementarlo completamente antes del MVP |
| Ampliar la presentación inicial | Dieciséis diapositivas resultaban insuficientes para cubrir el proyecto | Mantener una presentación demasiado sintética |
| Explicar el proyecto “en criollo” | La audiencia principal no es técnica | Usar documentación técnica como presentación |
| Probar primero una invitación de usuario nuevo | Valida la cadena más larga | Comenzar únicamente por el caso de usuario existente |
| No seleccionar automáticamente un socio de prueba | Se requiere confirmar control del email y evitar afectar a terceros | Elegir por similitud de nombre o dirección |
| No modificar arbitrariamente el email de un socio para probar | Alteraría datos reales y podría producir conflictos | Fabricar un candidato cambiando datos productivos |

## 9. Ideas descartadas

### 9.1 Plan de ahorro para comprar una cámara

Se evaluó un sistema parecido a los planes de ahorro de concesionarias de automóviles.

Problema identificado:

- El adjudicatario podría recibir el dinero o comprar el equipo y luego dejar de pagar las cuotas restantes.

Motivo del descarte:

- El riesgo financiero y operativo no resultó convincente.
- Se prefirió trabajar con sorteos mensuales para socios con cuota al día y sorteos de equipos grandes para una cantidad determinada de inversores.

### 9.2 Modificar globalmente `packages/auth`

Se consideró necesario retornar desde `/recuperar/[token]` hacia una invitación.

Limitación encontrada:

- `requestPasswordReset` construía el enlace internamente.
- El flujo no admitía transportar `next`.
- `/recuperar/[token]` no leía ese parámetro.
- `resetFotofficePasswordAction` terminaba en `redirect("/")`.
- `packages/auth` es compartido con otras aplicaciones.

Motivo del descarte:

- Modificarlo podía generar regresiones globales.
- Se resolvió mediante una cookie segura exclusiva de FotoOffice.

### 9.3 Vinculación temprana del socio

Se descartó vincular `Member.userId` al crear el usuario o enviar el email.

Motivo:

- Un usuario sin contraseña todavía no demostró acceso.
- El socio todavía no aceptó explícitamente.
- La vinculación debe realizarse dentro de la transacción de aceptación.

### 9.4 Crear `WorkspaceMembership` para el socio

Se descartó convertir automáticamente al socio en integrante administrativo del workspace.

Motivo:

- El socio necesita portal, no panel.
- `WorkspaceMembership` habilita una frontera diferente.
- Podría otorgar permisos indebidos.

### 9.5 Creación automática de workspaces al iniciar sesión

Se descartó llamar indiscriminadamente a `ensureFotofficeWorkspaceForUser`.

Motivo:

- Generaba “workspaces fantasma”.
- Un socio que inicia sesión no necesariamente administra una institución.
- Los guards deben ejecutarse antes de cualquier `ensure`.

### 9.6 Considerar `ok: true` como prueba de envío

Se descartó usar solamente el resultado general de `requestPasswordReset`.

Motivo:

- La respuesta es deliberadamente neutra para evitar enumeración de usuarios.
- Puede devolver `ok: true` sin haber enviado nada.
- La prueba real es `emailResult.sent === true`.

### 9.7 Exponer errores crudos de Resend

Se descartó mostrar o registrar `reason`.

Motivo:

- Puede contener hasta 120 caracteres del cuerpo crudo del proveedor.
- Puede incluir información técnica como `validation_error`, `403` o dominios internos.
- No aporta una solución al socio.

### 9.8 Usar el remitente fallback de DNX Suite

Se descartó:

`DNX Suite <noreply@dnxsuite.com>`

Motivo:

- `dnxsuite.com` no estaba verificado.
- Resend habría rechazado el email.
- FotoOffice debía utilizar un remitente de `mail.fotoffice.com`.

### 9.9 Usar staging como flujo predeterminado de FotoOffice

Se descartó para las publicaciones autorizadas.

Motivo:

- La directriz definida fue desplegar FotoOffice directamente a producción real.

Esta decisión no elimina la posibilidad de cambiar la estrategia en el futuro, pero requiere autorización explícita.

### 9.10 Integrar FotoOffice inmediatamente al primer despliegue general de DNX Partners

Se postergó la integración inicial.

Motivo:

- Se buscó desplegar Partners progresivamente.
- FotoOffice tenía modificaciones y necesidades particulares pendientes.

No significa que DNX Partners haya sido descartado para FotoOffice.

### 9.11 Presentar DNX como producto central ante la SFPR

Se descartó usar DNX como nombre protagonista.

Motivo:

- La presentación debía ser comprensible para la Comisión.
- FotoOffice representa mejor el producto que la institución utilizará.

## 10. Preguntas abiertas / pendientes de definir

1. PENDIENTE DE DEFINIR: nombre técnico y comercial definitivo entre “FotoOffice” y “Fotoffice”.
2. PENDIENTE DE DEFINIR: si se normalizarán rutas, paquetes o nombres internos que todavía usan `fotoffice`.
3. PENDIENTE DE DEFINIR: contenido exacto de la presentación de Canva mostrada antes de proponer nuevas funcionalidades.
4. PENDIENTE DE DEFINIR: listado final de propuestas surgidas después de la presentación de Canva.
5. PENDIENTE DE DEFINIR: versión definitiva de 25 a 30 diapositivas.
6. PENDIENTE DE DEFINIR: si se generará un PDF institucional definitivo además del PPTX.
7. PENDIENTE DE DEFINIR: profundidad económica que debe mostrarse a la Comisión Directiva.
8. PENDIENTE DE DEFINIR: aprobación formal del proyecto por parte de la Comisión.
9. PENDIENTE DE DEFINIR: alcance exacto del MVP que se considerará comercialmente terminado.
10. PENDIENTE DE DEFINIR: estado técnico actual de cada módulo después del SHA histórico `c07d6432`.
11. PENDIENTE DE DEFINIR: candidato para la primera invitación real.
12. PENDIENTE DE DEFINIR: estado de la única `MemberInvitation` histórica existente.
13. PENDIENTE DE DEFINIR: si la primera prueba utilizará un socio asociado a Daniel Cuart.
14. PENDIENTE DE DEFINIR: dirección controlada explícitamente por Daniel para la prueba.
15. PENDIENTE DE DEFINIR: recorrido posterior para probar el caso de usuario existente.
16. PENDIENTE DE DEFINIR: comportamiento del portal cuando un socio pertenece a más de una institución.
17. PENDIENTE DE DEFINIR: interfaz para seleccionar institución cuando exista el segundo caso real.
18. PENDIENTE DE DEFINIR: política de limpieza de cuentas sin contraseña creadas por activaciones abandonadas.
19. PENDIENTE DE DEFINIR: si `emailVerifiedAt` debe documentar además el origen de la verificación.
20. PENDIENTE DE DEFINIR: tests específicos para los wrappers de cookies basados en `next/headers`.
21. PENDIENTE DE DEFINIR: formato completo del encabezado CSV de socios.
22. PENDIENTE DE DEFINIR: política definitiva para matrimonios o personas que comparten email.
23. PENDIENTE DE DEFINIR: si se permitirá iniciar sesión sin email en casos excepcionales.
24. PENDIENTE DE DEFINIR: tabla definitiva de categorías de socio.
25. PENDIENTE DE DEFINIR: estados completos de socio además de `ACTIVE`.
26. PENDIENTE DE DEFINIR: reglas exactas para determinar “cuota al día”.
27. PENDIENTE DE DEFINIR: periodicidad y actualización de importes de cuota.
28. PENDIENTE DE DEFINIR: reglas contables del pago anual con dos meses bonificados.
29. PENDIENTE DE DEFINIR: tratamiento del pago anual cuando se realiza en un mes distinto de enero.
30. PENDIENTE DE DEFINIR: configuración exacta del split de pagos `1:N`.
31. PENDIENTE DE DEFINIR: quién absorbe el fee del 5% en cada workspace.
32. PENDIENTE DE DEFINIR: módulos adicionales a los que se aplicará el fee.
33. PENDIENTE DE DEFINIR: diseño definitivo del carnet.
34. PENDIENTE DE DEFINIR: información visible en el carnet.
35. PENDIENTE DE DEFINIR: reglas de vencimiento o actualización del carnet.
36. PENDIENTE DE DEFINIR: alcance definitivo del Website Builder.
37. PENDIENTE DE DEFINIR: relación exacta entre la web pública y `/w/sfpr/cursos`.
38. PENDIENTE DE DEFINIR: alcance del blog.
39. PENDIENTE DE DEFINIR: flujos editoriales y permisos del blog.
40. PENDIENTE DE DEFINIR: reglas de disponibilidad, cancelación y cobro de reservas.
41. PENDIENTE DE DEFINIR: si salón y estudio tendrán tarifas distintas para socios y terceros.
42. PENDIENTE DE DEFINIR: alcance del módulo de coworking.
43. PENDIENTE DE DEFINIR: alcance del laboratorio.
44. PENDIENTE DE DEFINIR: alcance del módulo de streaming.
45. PENDIENTE DE DEFINIR: modelo de cursos, docentes, cupos, pagos y certificados.
46. PENDIENTE DE DEFINIR: integración definitiva de cursos con comunicaciones.
47. PENDIENTE DE DEFINIR: alcance de la tienda y merchandising.
48. PENDIENTE DE DEFINIR: reglas de inventario y pagos de la tienda.
49. PENDIENTE DE DEFINIR: momento exacto de integración de FotoOffice con DNX Partners.
50. PENDIENTE DE DEFINIR: modelo de contratos de beneficios.
51. PENDIENTE DE DEFINIR: permisos para crear y aprobar empresas, sponsors y beneficios.
52. PENDIENTE DE DEFINIR: reglas para reutilizar empresas globales sin mezclar configuraciones de workspaces.
53. PENDIENTE DE DEFINIR: alcance definitivo de Tesorería.
54. PENDIENTE DE DEFINIR: reportes, facturas y cierre anual.
55. PENDIENTE DE DEFINIR: niveles de transparencia institucional.
56. PENDIENTE DE DEFINIR: quién puede presentar proyectos institucionales.
57. PENDIENTE DE DEFINIR: estados y circuito de aprobación de proyectos.
58. PENDIENTE DE DEFINIR: reglas de quorum y validez de votaciones.
59. PENDIENTE DE DEFINIR: formato y firma de actas digitales.
60. PENDIENTE DE DEFINIR: inmutabilidad técnica requerida para actas e historial.
61. PENDIENTE DE DEFINIR: alcance inicial del módulo de comunicación.
62. PENDIENTE DE DEFINIR: qué eventos generarán comunicaciones automáticas.
63. PENDIENTE DE DEFINIR: si las piezas automáticas se publican o solamente se proponen para aprobación.
64. PENDIENTE DE DEFINIR: permisos del equipo de comunicación.
65. PENDIENTE DE DEFINIR: canales incluidos además de email e historias.
66. PENDIENTE DE DEFINIR: diseñador de historias y plantillas institucionales.
67. PENDIENTE DE DEFINIR: reglas completas de sorteos gratuitos.
68. PENDIENTE DE DEFINIR: reglas completas de sorteos con bono contribución.
69. PENDIENTE DE DEFINIR: mecanismo técnico de inmutabilidad de resultados.
70. PENDIENTE DE DEFINIR: tratamiento legal, fiscal y contable de los sorteos.
71. PENDIENTE DE DEFINIR: funcionamiento completo de la red tipo BNI.
72. PENDIENTE DE DEFINIR: criterios de calificación y alertas.
73. PENDIENTE DE DEFINIR: alcance de los beneficios para estudiantes de ISET 18.
74. PENDIENTE DE DEFINIR: alcance del módulo de subsidios.
75. PENDIENTE DE DEFINIR: alcance de portfolios y muestras itinerantes.
76. PENDIENTE DE DEFINIR: aplicación de FotoOffice a workspaces individuales de fotógrafos.
77. PENDIENTE DE DEFINIR: funcionamiento de “Beneficios para mis clientes”.
78. PENDIENTE DE DEFINIR: roles completos y matriz de permisos.
79. PENDIENTE DE DEFINIR: política de retención de auditorías.
80. PENDIENTE DE DEFINIR: estrategia futura de Preview, staging y Production.
81. PENDIENTE DE DEFINIR: si el estado productivo y los conteos documentados continúan vigentes.
82. PENDIENTE DE DEFINIR: errores de lint preexistentes y si deben corregirse.
83. PENDIENTE DE DEFINIR: relación exacta entre FotoOffice, FotoRank y el resto del ecosistema en la narrativa institucional.
84. PENDIENTE DE DEFINIR: ubicación definitiva de esta documentación dentro del repositorio.
85. PENDIENTE DE DEFINIR: mecanismo para mantener este documento actualizado después de cada decisión.

## 11. Plan de trabajo propuesto

### Etapa 1 — Verificación del estado real

**Objetivo**

Confirmar si el repositorio, Vercel y la base continúan en el estado documentado.

**Entregable**

Informe de solo lectura con:

- Rama actual.
- `origin`.
- `HEAD`.
- Worktree.
- Commits posteriores a `c07d6432`.
- Migraciones.
- Deployment productivo.
- Dominios.
- Variables por nombre y entorno, sin secretos.
- Conteos actuales.
- Estado de tests y build.

**Verificación**

- No se modifica Git.
- No se modifica Vercel.
- No se modifica la base.
- No se envían emails.
- Todos los datos se obtienen mediante operaciones de solo lectura.

### Etapa 2 — Consolidación del inventario de módulos

**Objetivo**

Comparar todos los módulos mencionados en este documento con el código actual.

**Entregable**

Matriz con estados:

- `PUBLICADO`
- `IMPLEMENTADO LOCALMENTE`
- `EN DESARROLLO`
- `APROBADO`
- `PROPUESTO`
- `PENDIENTE`
- `DESCARTADO`
- `REQUIERE VERIFICACIÓN`

**Verificación**

Cada estado debe incluir evidencia:

- Archivo.
- Ruta.
- Modelo.
- Migración.
- Test.
- Página publicada.
- Documento de decisión.

No se debe asumir implementación basándose solamente en este documento.

### Etapa 3 — Primera invitación real controlada

**Objetivo**

Validar de punta a punta el recorrido de un socio nuevo.

**Entregable**

Una invitación real a un socio `ACTIVE` cuyo email controle explícitamente Daniel.

**Procedimiento previo**

1. Inspeccionar la única `MemberInvitation` existente.
2. Identificar candidatos sin mostrar datos personales completos.
3. Separar:
   - Emails pertenecientes a `User` existente.
   - Emails sin `User`.
4. Confirmar que `Member.userId` sea `null`.
5. Confirmar ausencia de invitación pendiente vigente.
6. Obtener confirmación explícita del titular del email.
7. No cambiar arbitrariamente datos del padrón.

**Verificación**

Debe completarse:

1. Recepción del email de invitación.
2. Apertura del enlace.
3. Creación de contraseña.
4. Recepción del segundo email.
5. Establecimiento de contraseña.
6. Login.
7. Regreso a la invitación.
8. Aceptación explícita.
9. Vinculación única de `Member.userId`.
10. Actualización correcta de `emailVerifiedAt`.
11. Acceso a `/portal`.
12. Ausencia de `WorkspaceMembership`.
13. Ausencia de workspace nuevo.
14. Auditorías correctas.
15. Eliminación de la cookie.

### Etapa 4 — Validación del caso de usuario existente

**Objetivo**

Probar el recorrido alternativo sin crear una identidad duplicada.

**Entregable**

Invitación controlada a un socio cuyo email ya pertenezca a un `User`, con autorización explícita.

**Verificación**

- No se crea otro `User`.
- Se solicita iniciar sesión.
- El email coincide.
- La aceptación vincula una sola vez.
- No se crea `WorkspaceMembership`.
- Se accede a `/portal`.

### Etapa 5 — Cierre del núcleo de socios

**Objetivo**

Completar socios, padrón, categorías, estados, importación, exportación y auditoría.

**Entregable**

Módulo de socios considerado funcionalmente completo.

**Verificación**

- Importación CSV reproducible.
- Exportación CSV.
- Normalización de DNI/CUIT/CUIL.
- Conflictos detectados antes de escribir.
- Historial auditable.
- Conteos intactos.
- Tests de casos límite.
- QA autenticado de ficha y padrón.

### Etapa 6 — Cuotas y Mercado Pago

**Objetivo**

Completar el cobro mensual y anual con cuenta corriente.

**Entregable**

Flujo productivo para:

- Cuota mensual.
- Pago anual de diez cuotas con dos meses bonificados.
- Registro contable.
- Estado de deuda.
- Fee del 5%.

**Verificación**

- Webhooks idempotentes.
- Pagos conciliados.
- Cuenta corriente correcta.
- Fee sumado o descontado según configuración.
- Ningún pago duplicado.
- Reportes verificables.
- Casos de devolución y fallo cubiertos.

### Etapa 7 — Carnets automáticos

**Objetivo**

Emitir credenciales a partir del estado real del socio.

**Entregable**

Carnet digital generado y actualizado automáticamente.

**Verificación**

- Datos correctos.
- Número de socio correcto.
- Estado institucional correcto.
- Diseño aprobado.
- Acceso desde `/portal`.
- Sin exposición de información sensible innecesaria.

### Etapa 8 — Página web pública y Website Builder

**Objetivo**

Completar la presencia pública de la SFPR.

**Entregable**

Sitio público con:

- Inicio.
- Información institucional.
- Cursos.
- Beneficios seleccionados.
- Blog.
- Contenidos configurables.

**Verificación**

- Responsive.
- Sin rutas rotas.
- Sin 5xx.
- Permisos de edición correctos.
- Publicación y borrador diferenciados.
- Diseño aprobado visualmente.

### Etapa 9 — Reservas

**Objetivo**

Administrar salón, estudio y futuros espacios.

**Entregable**

Calendario y flujo de reservas.

**Verificación**

- Disponibilidad correcta.
- Prevención de superposiciones.
- Reglas de cancelación.
- Tarifas configurables.
- Historial.
- Notificaciones.
- Integración con pagos si corresponde.

### Etapa 10 — Cursos y comunicaciones

**Objetivo**

Administrar cursos, cupos, inscripciones y emails.

**Entregable**

Módulo de cursos integrado con web pública y comunicaciones.

**Verificación**

- Publicación del curso.
- Inscripción.
- Cupos.
- Pago, si corresponde.
- Firma del workspace una sola vez.
- Emails HTML y texto.
- Auditoría y reintentos.

### Etapa 11 — Beneficios, sponsors y DNX Partners

**Objetivo**

Conectar FotoOffice con la base global de empresas.

**Entregable**

Módulo de:

- Empresas.
- Beneficios.
- Sponsors.
- Contratos.
- Apariciones visuales.

**Verificación**

- Una empresa puede reutilizarse.
- La configuración es específica de cada workspace.
- No se mezclan contratos ni beneficios.
- Los permisos están definidos.
- Las piezas visuales reflejan branding correcto.

### Etapa 12 — Tesorería y gobierno institucional

**Objetivo**

Centralizar administración financiera y decisiones institucionales.

**Entregable**

Módulos de:

- Tesorería.
- Facturas.
- Cierre anual.
- Proyectos.
- Orden del día.
- Votaciones.
- Actas.
- Archivo.
- Transparencia.

**Verificación**

- Roles correctos.
- Auditoría inmutable.
- Quorum y estados definidos.
- Actas reproducibles.
- Reportes financieros consistentes.
- Niveles de visibilidad respetados.

### Etapa 13 — Comunicación institucional

**Objetivo**

Dar al equipo de comunicación una bandeja de sucesos y herramientas de publicación.

**Entregable**

Primera versión progresiva con:

- Usuarios específicos.
- Notificaciones de acontecimientos.
- Bienvenida a socios.
- Comunicación de sponsors y beneficios.
- Plantillas de historias.

**Verificación**

- Ninguna publicación automática sin la aprobación definida.
- Datos correctos.
- Branding correcto.
- Permisos específicos.
- Historial de generación y publicación.

### Etapa 14 — Sorteos

**Objetivo**

Implementar sorteos transparentes y auditables.

**Entregable**

Dos tipos separados:

1. Sorteos gratuitos para socios con cuota al día.
2. Sorteos con bono contribución.

**Verificación**

- Elegibilidad correcta.
- Ruleta animada.
- Resultado inmutable.
- Auditoría.
- Sin repetición indebida por socio y mes.
- Reglas legales y contables aprobadas.

### Etapa 15 — Expansiones

**Objetivo**

Incorporar servicios de mayor alcance cuando el núcleo esté consolidado.

**Entregable**

Plan priorizado para:

- Coworking.
- Laboratorio.
- Streaming.
- Tienda.
- Merchandising.
- Portfolio.
- Muestras itinerantes.
- Subsidios.
- Red tipo BNI.
- Alianzas educativas.
- Workspaces de fotógrafos.
- Beneficios para clientes.

**Verificación**

Cada módulo debe contar antes de implementarse con:

- Problema definido.
- Usuario objetivo.
- Reglas.
- Modelo de datos.
- Dependencias.
- Prioridad.
- Aprobación explícita.

### Etapa 16 — Presentación institucional definitiva

**Objetivo**

Actualizar la presentación para reflejar la visión completa y el estado real.

**Entregable**

Presentación de 25 a 30 diapositivas y posible PDF institucional.

Debe incluir:

- Problema.
- Visión.
- Beneficios.
- MVP.
- Módulos.
- Fases.
- Modelo económico.
- Gobierno.
- Transparencia.
- Sponsors.
- Comunicación.
- Impacto.
- Próximos pasos.

**Verificación**

- Usa FotoOffice como marca principal.
- Está escrita en lenguaje claro.
- Distingue lo existente de lo futuro.
- No promete funciones no aprobadas.
- Resulta comprensible para la Comisión Directiva.
- Fue revisada visualmente.
- Fue aprobada por Daniel antes de presentarse.

## 12. Glosario

### FotoOffice

Plataforma modular y multi-workspace para gestionar instituciones, asociaciones, espacios y servicios relacionados con la fotografía.

### Fotoffice

Variante del nombre utilizada en rutas, nombres técnicos o conversaciones. Su normalización definitiva está pendiente.

### SFPR

Sociedad de Fotógrafos Profesionales de Rosario. Primer workspace real de FotoOffice.

### DNX Suite

Ecosistema técnico y de productos dentro del cual se desarrolla FotoOffice. No debe ser la marca protagonista de la presentación institucional de FotoOffice.

### Workspace

Espacio lógico y de datos correspondiente a una institución, organización o futuro fotógrafo individual.

### `User`

Identidad global del monorepo. Puede autenticarse y vincularse con entidades de distintas aplicaciones.

### `Member`

Socio perteneciente a un workspace institucional.

### `WorkspaceMembership`

Relación que habilita acceso administrativo u operativo a un workspace. No equivale a ser socio.

### Portal del socio

Superficie separada del panel administrativo, accesible mediante `/portal`.

### Panel administrativo

Interfaz de gestión utilizada por `OWNER`, `ADMIN` y otros roles autorizados.

### `OWNER`

Rol con capacidad de administración superior dentro de un workspace.

### `ADMIN`

Rol administrativo autorizado para gestionar socios e invitaciones.

### `STAFF`

Rol operativo que no debe administrar invitaciones cuando esa función está restringida a `OWNER` y `ADMIN`.

### `ACTIVE`

Estado requerido para que un socio pueda ser invitado y vinculado.

### Invitación

Mecanismo mediante el cual un `Member` se vincula de forma segura con un `User`.

### Continuidad de invitación

Información temporal guardada en una cookie para regresar a la invitación después de crear una contraseña e iniciar sesión.

### `fotoffice_member_invitation`

Nombre propuesto para la cookie de continuidad de invitación.

### `HttpOnly`

Atributo que impide leer la cookie desde JavaScript.

### `Secure`

Atributo que restringe el envío de la cookie a conexiones HTTPS.

### `SameSite=Lax`

Política de cookie utilizada para reducir riesgos de solicitudes entre sitios sin impedir el flujo normal de navegación.

### `requestPasswordReset`

Función compartida de autenticación utilizada para generar el token y email de establecimiento o recuperación de contraseña.

### `sendIdentityEmail`

Transporte de email de identidad que devuelve `{sent, skipped, reason}`.

### `emailResult`

Resultado estructurado que permite saber si el email fue enviado, omitido o rechazado.

### `ensureFotofficeWorkspaceForUser`

Función que asegura o crea un workspace para determinados usuarios. No debe ejecutarse durante el flujo normal del socio.

### `createFotofficeSessionForUser`

Función mediante la cual se crea una sesión autenticada de FotoOffice.

### `APP_URL`

Variable utilizada para construir enlaces absolutos. En Production debe ser `https://fotoffice.com`.

### `EMAIL_FROM`

Variable que define el remitente del email de identidad.

### `DNX_EMAIL_FROM`

Fallback configurable del remitente compartido.

### `RESEND_API_KEY`

Credencial utilizada para enviar emails mediante Resend.

### `FOTOFFICE_NOTIFICATIONS_FROM`

Variable de remitente asociada con notificaciones de FotoOffice. No fue modificada durante el despliegue documentado.

### Resend

Proveedor de envío de emails utilizado por el sistema.

### `emailVerifiedAt`

Campo de `User` que registra la fecha de verificación del email.

### `MemberInvitation`

Tabla o entidad que registra invitaciones de socios.

### `MemberAudit`

Tabla o entidad que conserva auditorías relacionadas con socios.

### `MemberAuditAction`

Enum que define los tipos de auditoría.

### `INVITE_CREATED`

Auditoría de creación de una invitación.

### `INVITE_SENT`

Auditoría de envío inicial aceptado por el proveedor.

### `INVITE_RESENT`

Auditoría de reenvío aceptado por el proveedor.

### `INVITE_SEND_FAILED`

Auditoría de fallo o rechazo del envío.

### `INVITE_REVOKED`

Auditoría de revocación.

### `INVITE_ACCEPTED`

Auditoría de aceptación explícita.

### `USER_LINKED`

Auditoría de vinculación entre `Member` y `User`.

### `sentAt`

Fecha nullable que confirma que el proveedor aceptó el email de invitación.

### `sendFailedAt`

Fecha nullable que registra un fallo del envío.

### Prisma

ORM y sistema de migraciones utilizado por el proyecto.

### `prisma migrate status`

Comando utilizado para inspeccionar migraciones pendientes.

### `prisma migrate deploy`

Comando autorizado para aplicar migraciones en producción.

### `prisma db push`

Comando explícitamente prohibido para migraciones productivas.

### `prisma validate`

Comando utilizado para validar el esquema Prisma.

### Migración aditiva

Migración que agrega campos nullable o valores de enum sin eliminar ni reescribir datos existentes.

### Backfill

Actualización de registros históricos para completar nuevos campos. La migración de invitaciones no realizó backfill.

### Fast-forward

Push que avanza la rama sin merge, rebase ni reescritura de historia.

### Production

Entorno productivo real de FotoOffice.

### Preview

Deployment no productivo generado por una rama o cambio. No debe promoverse sin autorización.

### Rollback

Retorno al deployment de código anterior. En el caso documentado no requiere revertir la migración aditiva.

### Website Builder

Módulo para construir y administrar la página pública de cada workspace.

### DNX Partners

Módulo compartido para empresas, sponsors, campañas, beneficios y apariciones publicitarias.

### Beneficio

Convenio o descuento que una empresa ofrece a socios o clientes de un workspace.

### Sponsor

Empresa o entidad que aporta recursos y recibe determinadas apariciones, comunicaciones o contraprestaciones.

### Base global de empresas

Registro compartido de empresas que puede reutilizarse desde distintos workspaces sin duplicar su identidad.

### Fee

Comisión de FotoOffice aplicada a operaciones. El valor predeterminado discutido es 5%.

### Pago anual

Modalidad en la que el socio paga el equivalente a diez cuotas y recibe dos meses bonificados.

### Gobierno institucional

Módulo de proyectos, orden del día, votaciones, actas, archivo y transparencia.

### BNI interno

Red de recomendaciones profesionales inspirada en la lógica de BNI, con recomendaciones, calificaciones y alertas.

### Sorteo gratuito

Sorteo destinado a socios elegibles, especialmente socios con cuota al día.

### Bono contribución

Mecánica de participación paga que debe tratarse separadamente del sorteo gratuito.

### Resultado inmutable

Resultado que no puede alterarse silenciosamente después del sorteo y conserva evidencia auditable.

### ISET 18

Institución educativa mencionada en relación con una alianza y un beneficio del 50% para estudiantes.

### `FotoOffice_SFPR_Presentacion_Proyecto.pptx`

Archivo de la presentación inicial del proyecto FotoOffice aplicado a la SFPR.

### `release/sponsor-global-technical-deploy`

Rama productiva documentada de FotoOffice.

### `fotoffice-dnxsuite`

Nombre del proyecto Vercel de FotoOffice.

### `prj_AUL05cB4eeBdtiidWcsC7bwUtHd5`

ID del proyecto Vercel autorizado.

### `c07d6432`

SHA corto del deployment que incorporó portal, invitaciones, activación y verificación de email.

### `dpl_GmCESEqPdyW7pGDNpeK5DGYrExpr`

Deployment productivo documentado para el SHA `c07d6432`.

### `dpl_84qi2wApHqKHF5DCoTpLwDUdX5zp`

Deployment anterior identificado como rollback.

### Claude Code

Herramienta a la que se transfiere este documento como contexto base. Debe verificar el estado real antes de modificar código o producción y no debe interpretar automáticamente todas las ideas como funciones aprobadas.
