# SUBÍ LA FOTO — Documento maestro de producto e implementación

**Proyecto:** nueva aplicación de DNX Suite  
**Nombre comercial:** Subí la Foto  
**Dominio deseado:** `subilafoto.com`  
**Fecha objetivo de lanzamiento:** 10 de octubre de 2026  
**Estado:** definición funcional integral para análisis e implementación progresiva  

---

## 1. Instrucción general para Claude Cowork y Claude Code

Usar este documento como fuente inicial de verdad para analizar, planificar y desarrollar una nueva aplicación de DNX Suite llamada **Subí la Foto**.

Antes de escribir código:

1. Inspeccionar la estructura real del monorepo DNX Suite.
2. Leer `CLAUDE.md`, `README`, archivos de arquitectura, convenciones, workspaces, paquetes compartidos, esquemas Prisma, autenticación, sistema de permisos, almacenamiento, emails y despliegue.
3. Identificar componentes que puedan reutilizarse de Comprame la Foto, FotoRank, Clickatón, FotoOffice, InfoSpot, DNX Payments, DNX Partners y paquetes compartidos.
4. No duplicar motores ya existentes si pueden extenderse de forma segura.
5. No asumir nombres de rutas, tablas, paquetes, proveedores ni variables de entorno hasta verificarlos en el repositorio.
6. Documentar las decisiones técnicas antes de realizar cambios estructurales.
7. Implementar mediante etapas pequeñas, verificables y reversibles.
8. Mantener compatibilidad con las aplicaciones existentes de DNX Suite.
9. No modificar producción, migraciones aplicadas o datos reales sin respaldo, plan de migración y autorización explícita.
10. Priorizar un producto excelente y estable para el 10 de octubre de 2026 por encima de funciones secundarias.

Este documento describe el producto completo. No significa que todas las funciones deban estar disponibles en la primera versión. Claude deberá convertirlo en:

- especificación funcional;
- diagnóstico de reutilización dentro del monorepo;
- arquitectura propuesta;
- modelo de datos;
- mapa de pantallas y recorridos;
- backlog priorizado;
- cronograma inverso hasta el 10 de octubre;
- criterios de aceptación;
- estrategia de pruebas y despliegue;
- registro de riesgos, supuestos y decisiones abiertas.

---

## 2. Visión del producto

**Subí la Foto** es una plataforma web para eventos sociales, congresos y encuentros empresariales que permite reunir, moderar, proyectar y conservar las fotografías, videos y mensajes producidos por invitados, asistentes, organizadores y fotógrafos.

La experiencia principal debe ser extremadamente sencilla:

> Escaneá el QR, subí la foto y compartila con todo el evento.

El invitado no debe instalar una aplicación ni crear una cuenta. Accede mediante un código QR o enlace, acepta las condiciones necesarias, elige o toma fotografías y las carga en pocos pasos. Según la configuración del evento, el contenido puede pasar por moderación y aparecer en tiempo real en una pantalla principal y en el álbum digital.

Subí la Foto debe ser también una herramienta comercial para fotógrafos, productoras, salones y organizadores. Ellos podrán crear eventos, personalizarlos, fijar su propio precio, enviarlos a sus clientes y pagar una comisión solamente cuando concretan una venta.

La aplicación será una nueva unidad de DNX Suite, conectada con servicios compartidos cuando sea conveniente, pero con identidad comercial propia y posibilidad futura de operar como producto autónomo o marca blanca.

---

## 3. Principios del producto

1. **Sin aplicación:** toda la experiencia del invitado funciona en el navegador.
2. **Sin fricción:** el invitado no necesita registrarse para participar.
3. **Mobile first:** carga, moderación y control deben funcionar correctamente desde celulares.
4. **Tiempo real:** las fotos aprobadas deben llegar rápidamente a las pantallas conectadas.
5. **Control del organizador:** nada se proyecta sin respetar la modalidad de moderación elegida.
6. **Diseño emocional:** cada evento debe sentirse único mediante plantillas, portada, colores y tipografías.
7. **Privacidad configurable:** no todos los eventos requieren la misma visibilidad ni permisos.
8. **Negocio alineado:** Subí la Foto gana cuando el fotógrafo u organizador vende.
9. **Reutilización responsable:** aprovechar la infraestructura de DNX Suite sin acoplar innecesariamente las aplicaciones.
10. **Escalabilidad progresiva:** comenzar con un núcleo excelente y agregar capacidades sin rehacer el producto.
11. **Trazabilidad:** pagos, moderación, eliminaciones, consentimientos y cambios importantes deben quedar auditados.
12. **Uso internacionalizable:** aunque el lanzamiento inicial sea en Argentina y en español, textos, moneda, zona horaria y formatos no deben quedar rígidamente acoplados.

---

## 4. Públicos y roles

### 4.1 Superadministrador de DNX Suite

Administra la aplicación completa, configuración global, comisiones, límites, planes futuros, plantillas globales, usuarios, eventos, incidencias, métricas, contenidos denunciados y parámetros operativos.

### 4.2 Fotógrafo, productora, salón u organizador

Es el vendedor y operador principal. Crea eventos, los personaliza, define el precio, envía el enlace de compra, administra invitados, proveedores, contenido, moderadores, pantallas y descargas.

### 4.3 Cliente contratante

Es quien compra o contrata el evento: pareja, familia, empresa, institución, organizador de congreso o responsable de una celebración. Puede recibir acceso limitado para completar datos, elegir una plantilla, revisar la portada, administrar contenido o descargar el álbum.

### 4.4 Administrador o colaborador del evento

Persona invitada por el creador para moderar, controlar la presentación, gestionar asistentes o resolver la operación durante el evento. Los permisos deben asignarse por rol y por evento.

### 4.5 Invitado o asistente

Accede mediante QR o enlace sin cuenta. Puede cargar fotos, videos o mensajes y, si está permitido, ver la galería, reaccionar, descargar o compartir.

### 4.6 Proveedor del evento

Recibe un enlace específico para completar o confirmar sus datos comerciales. Puede ser salón, catering, DJ, ambientación, iluminación, sonido, video, maquillaje, vestuario, transporte, hotel, imprenta, cabina de fotos, tecnología, seguridad, prensa, streaming, expositor, sponsor futuro u otro servicio relacionado.

### 4.7 Operador de pantalla

Controla qué se muestra, pausa la reproducción, cambia el diseño, destaca contenido y consulta el estado de conexión. Puede ser el fotógrafo, DJ, operador técnico o personal del salón.

---

## 5. Tipos de eventos

El sistema no debe limitarse a bodas o fiestas. Debe soportar, como mínimo:

- bodas;
- fiestas de quince;
- cumpleaños;
- aniversarios;
- bautismos y comuniones;
- egresos y actos escolares;
- fiestas empresariales;
- congresos;
- convenciones;
- conferencias;
- jornadas y seminarios;
- exposiciones y ferias;
- lanzamientos de productos;
- eventos institucionales;
- eventos deportivos;
- recitales y espectáculos;
- eventos gastronómicos;
- encuentros de asociaciones y cámaras;
- viajes y experiencias grupales;
- eventos personalizados.

El tipo de evento debe influir en plantillas, campos sugeridos, textos, permisos, módulos disponibles y flujo de configuración, sin crear productos técnicamente separados.

---

## 6. Propuesta comercial

### 6.1 Venta antes de la configuración

El fotógrafo u organizador no debe invertir tiempo configurando un evento que todavía no fue vendido. Cada profesional tendrá un **enlace permanente y personalizado de venta**, independiente de un evento específico.

Ejemplos conceptuales, sujetos a la arquitectura definitiva:

- `subilafoto.com/nombre-del-fotografo`
- `subilafoto.com/v/nombre-del-fotografo`

Desde su panel, el profesional define previamente su oferta comercial general: nombre del servicio, descripción, precio, adicionales disponibles, identidad visual básica y condiciones. Luego comparte siempre el mismo enlace con sus posibles clientes.

El cliente abre el enlace, conoce el producto, completa solamente los datos mínimos necesarios y paga. **Recién después de la confirmación segura del pago se crea el evento configurable y se habilita el trabajo del fotógrafo.**

Antes del pago no deben existir tareas de diseño, selección de plantilla, carga de portada ni configuración operativa obligatorias para el fotógrafo.

### 6.2 Precio libre con protección de costos

El vendedor define el precio final del evento. Subí la Foto cobra una comisión inicial propuesta del **15%** sobre la venta.

Debe existir una configuración global para:

- porcentaje de comisión;
- comisión mínima por evento;
- precio mínimo permitido o recomendado;
- impuestos aplicables;
- costos del medio de pago;
- modalidad para sumar o descontar costos financieros;
- promociones o comisiones especiales por usuario;
- cupones;
- eventos bonificados;
- devoluciones y contracargos.

La cifra del 15% debe ser configurable y no quedar escrita rígidamente en el código.

### 6.3 Flujo de venta confirmado

1. El profesional configura una sola vez su página o enlace permanente de venta.
2. Define su precio base y si la descarga final está incluida o se ofrece como adicional.
3. El sistema muestra comisión, costos y monto estimado a recibir.
4. El profesional comparte el enlace con el cliente.
5. El cliente abre la página, registra nombre, email, tipo y fecha aproximada del evento, acepta las condiciones comerciales y paga.
6. El pago se procesa mediante la infraestructura aprobada de DNX Payments.
7. Un webhook seguro e idempotente confirma el pago.
8. El sistema crea automáticamente una instancia de evento vinculada a la compra.
9. El evento queda en estado pagado, pendiente de configuración, pero todavía no activo para el público.
10. El fotógrafo recibe una notificación y comienza recién entonces a configurar plantilla, portada, horarios y experiencia.
11. El cliente recibe confirmación y, si corresponde, acceso a su panel simplificado.
12. El sistema registra la distribución del dinero y las condiciones adquiridas.

La activación pública del evento no es lo mismo que la activación comercial. Un evento puede estar `PAID` y `CONFIGURING` varios días antes de que comience su ventana pública de 12 horas.

Se debe analizar la integración real disponible para **split de pagos 1:N**, sin asumir que está habilitada hasta verificar homologación, credenciales y restricciones del proveedor.

### 6.4 Estados comerciales sugeridos

- `DRAFT`
- `READY_TO_SELL`
- `PAYMENT_PENDING`
- `PAID`
- `CONFIGURING`
- `DEMO_READY`
- `SCHEDULED`
- `ACTIVE`
- `FINALIZING`
- `DOWNLOAD_OFFERED`
- `DOWNLOAD_PURCHASED`
- `COMPLETED`
- `ARCHIVED`
- `CANCELLED`
- `REFUNDED`
- `PAYMENT_DISPUTED`

Los nombres definitivos deben alinearse con las convenciones existentes de DNX Suite.

### 6.5 Adicional de descarga y entrega por email

La descarga final de todo el contenido podrá venderse como un adicional. El valor sugerido inicialmente será **15% adicional sobre el precio base del evento**, pero debe ser configurable por el fotógrafo y por las reglas globales de la plataforma.

Ejemplo:

- evento base: $100.000;
- adicional de descarga: 15% = $15.000;
- total si se compra junto con el evento: $115.000.

Este **15% adicional por descarga** no debe confundirse con la **comisión del 15% de Subí la Foto**. Son conceptos diferentes:

- adicional de descarga: precio comercial que paga el cliente por recibir el paquete completo;
- comisión de plataforma: porcentaje que Subí la Foto retiene sobre la venta principal del evento.

El adicional debe poder ofrecerse:

1. durante la compra inicial;
2. después de la compra y antes del evento;
3. al finalizar el evento, cuando el cliente intenta descargar;
4. desde el email del día siguiente.

La recomendación inicial es que el fotógrafo pueda elegir entre tres modalidades:

- descarga incluida;
- descarga opcional con precio porcentual, inicialmente 15%;
- descarga opcional con precio fijo.

La distribución económica queda confirmada de esta manera:

- venta principal del evento: se distribuye conforme a la comisión configurada entre fotógrafo y plataforma;
- adicional de descarga y entrega: **100% del ingreso corresponde a Subí la Foto**;
- el fotógrafo no recibe participación sobre este adicional;
- impuestos, costos del medio de pago, devoluciones y contracargos deben contabilizarse separadamente para determinar el ingreso neto real de la plataforma.

La página de compra debe explicar con claridad qué incluye el servicio principal y qué agrega la compra del paquete descargable. No debe inducir al cliente a creer que perderá el acceso visual inmediatamente si no compra, salvo que esa sea realmente la condición informada.

### 6.6 Recuperación comercial de la descarga

Si el cliente no compra el adicional inicialmente, Subí la Foto podrá ofrecérselo después del evento mediante una secuencia automática de emails. El objetivo es recordarle que el contenido está disponible temporalmente y que puede adquirir la preparación y entrega del paquete completo antes de su eliminación.

Secuencia inicial propuesta:

| Momento | Comunicación |
|---|---|
| Día siguiente al evento | Álbum disponible y primera oferta de descarga |
| 3 días después | Recordatorio breve con acceso directo |
| 7 días después | Recordatorio de primera semana |
| 15 días después | Aviso de mitad del período de conservación |
| 30 días después | Último aviso con hora exacta de vencimiento |

El último aviso debe enviarse con tiempo real suficiente para completar el pago y la generación del archivo. La eliminación no debe ejecutarse mientras exista un pago iniciado, confirmado o un paquete en procesamiento. Claude debe definir una ventana técnica de gracia que evite carreras entre pago y borrado.

Cada email debe incluir:

- nombre del evento;
- fecha;
- enlace seguro para comprar o recuperar la compra;
- precio vigente;
- explicación concreta del contenido incluido;
- fecha y hora exactas de vencimiento;
- aviso de eliminación posterior;
- ayuda ante problemas;
- enlace para dejar de recibir recordatorios comerciales no esenciales.

La secuencia debe detenerse inmediatamente cuando el adicional se paga, el cliente rechaza los recordatorios o el contenido se elimina. No se deben enviar mensajes duplicados por reintentos.

---

## 7. Creación y configuración del evento

El evento configurable nace después del pago confirmado. El asistente debe permitir guardar y continuar después, mostrar el progreso y evitar formularios excesivamente largos.

### 7.1 Datos generales

- nombre del evento;
- tipo de evento;
- descripción breve;
- anfitriones, homenajeados, empresa o institución;
- fecha y hora de inicio;
- fecha y hora de activación pública;
- hora calculada de desactivación;
- zona horaria;
- lugar;
- dirección;
- ubicación en mapa o enlace externo;
- capacidad estimada;
- idioma;
- privacidad;
- datos de contacto operativo;
- datos del cliente contratante;
- slug o enlace amigable;
- portada y tema visual.

### 7.4 Ventana de activación de 12 horas

Cada evento tendrá una hora exacta de activación configurada por el fotógrafo. A partir de ese momento, la experiencia pública permanecerá activa durante **12 horas consecutivas**.

Ejemplo:

- activación: sábado 20:00;
- desactivación automática: domingo 08:00.

La hora de desactivación se calcula automáticamente y debe mostrarse claramente antes de confirmar. El sistema debe usar la zona horaria del evento y resolver correctamente cambios de fecha y horario de verano en países donde corresponda.

Durante la ventana activa:

- los invitados pueden ingresar mediante QR;
- pueden cargar contenido;
- la IA modera las fotografías;
- el contenido aprobado puede aparecer en pantalla y galería;
- el operador controla la presentación.

Al cumplirse las 12 horas:

- se cierran nuevas cargas automáticamente;
- la pantalla pública pasa a una placa de cierre configurable;
- el álbum entra en estado de procesamiento final;
- se inicia la preparación del paquete de descarga cuando fue contratado;
- no se elimina el contenido;
- los accesos posteriores respetan la modalidad de álbum y compra definida.

Los cambios manuales de horario deben estar restringidos, auditados y no deben extender gratuitamente un evento ya iniciado salvo permiso administrativo o regla comercial expresa.

### 7.5 Modo DEMO anterior a la activación

Antes de la hora de activación, el fotógrafo debe poder realizar pruebas sin consumir la ventana real de 12 horas.

El modo DEMO debe permitir:

- abrir una vista previa móvil;
- mostrar la portada;
- probar el QR de demostración;
- cargar fotografías de prueba;
- verificar la moderación automática;
- revisar la galería;
- probar la pantalla 16:9;
- comprobar transiciones, colores, textos y logos;
- verificar la conexión del dispositivo que se usará durante el evento;
- ensayar el panel de control.

Toda pantalla de demostración debe mostrar una identificación visible de **DEMO**. Los enlaces y QR de prueba deben diferenciarse de los definitivos.

El contenido de prueba debe quedar marcado como tal. Antes de la activación, el fotógrafo podrá borrarlo o conservarlo de manera explícita. Por defecto, las pruebas no deben mezclarse con las fotografías reales ni incluirse en el paquete final.

La DEMO no habilita el evento para invitados reales ni modifica la hora contratada.

### 7.2 Configuración de participación

- permitir fotos;
- permitir varias fotos por carga;
- permitir videos;
- duración y tamaño máximos de video;
- permitir mensajes o dedicatorias;
- pedir nombre del participante;
- permitir participación anónima;
- pedir email o teléfono de forma opcional y con consentimiento explícito;
- limitar cargas por persona o dispositivo;
- habilitar o cerrar cargas manualmente;
- programar apertura y cierre;
- permitir cámara, galería del teléfono o ambas;
- conservar calidad original;
- generar versiones optimizadas para pantalla;
- mostrar estado de carga y confirmación;
- permitir eliminar el contenido propio mediante un mecanismo seguro;
- incluir instrucciones personalizables.

### 7.3 Privacidad y visibilidad

- evento público mediante enlace;
- evento no indexado;
- acceso con código o contraseña;
- acceso por lista de invitados;
- cargar sin poder ver el álbum;
- ver solamente contenido aprobado;
- permitir o impedir descargas;
- permitir compartir enlaces;
- ocultar nombres;
- requerir aceptación de términos;
- consentimiento específico para uso promocional, separado del consentimiento necesario para operar el servicio;
- política de conservación y eliminación del contenido;
- canal para denunciar o pedir baja de una imagen.

---

## 8. Sistema de plantillas y personalización visual

Subí la Foto debe ofrecer una biblioteca amplia de plantillas, comparable o superior a la de Selpix, pero con diseño propio y sin copiar recursos protegidos.

### 8.1 Categorías iniciales de plantillas

- boda clásica;
- boda moderna;
- boda campestre;
- boda minimalista;
- fiesta de quince;
- cumpleaños infantil;
- cumpleaños adulto;
- egresados;
- evento empresarial;
- congreso y conferencia;
- gala institucional;
- evento deportivo;
- recital o festival;
- temática tropical;
- temática retro;
- temática años ochenta;
- elegante negro y dorado;
- floral;
- rústica;
- tecnológica;
- personalizada desde cero.

### 8.2 Componentes de una plantilla

- fotografía o imagen de portada;
- portada alternativa para móvil y pantalla horizontal;
- imagen de fondo;
- paleta de colores;
- tipografías;
- logo o monograma;
- marcos y elementos decorativos;
- estilos de botones;
- iconografía;
- diseño del QR;
- pantalla de carga;
- pantalla de confirmación;
- galería;
- presentación en vivo;
- placa de pausa;
- placa de cierre;
- transiciones;
- ubicación del nombre del evento y fecha.

### 8.3 Edición por el usuario

- cambiar foto de portada;
- recortar y reposicionar la portada;
- previsualizar en celular, escritorio y pantalla 16:9;
- cambiar colores y tipografías permitidas;
- agregar logo;
- editar títulos y mensajes;
- seleccionar transiciones;
- duplicar una configuración;
- restablecer la plantilla;
- guardar como plantilla propia en una etapa posterior.

Las fotos de portada prediseñadas deben contar con licencias claras. También se puede permitir que el usuario cargue fotografías propias. Las imágenes no deben depender de enlaces externos frágiles.

### 8.4 Administración de plantillas

El superadministrador debe poder crear, editar, duplicar, ordenar, activar, desactivar y categorizar plantillas sin desplegar código, siempre que la arquitectura existente lo permita de forma segura.

---

## 9. Experiencia del invitado

### 9.1 Acceso

1. Escanea el QR o abre el enlace.
2. Ve una portada rápida y adaptada al evento.
3. Recibe una explicación breve.
4. Acepta las condiciones requeridas.
5. Elige “Subir fotos”, “Sacar una foto”, “Subir video” o “Dejar un mensaje”, según módulos habilitados.

### 9.2 Carga de contenido

- selección múltiple;
- vista previa;
- posibilidad de quitar archivos antes de enviar;
- compresión o subida reanudable cuando corresponda;
- indicador individual y general de progreso;
- prevención de envíos duplicados accidentales;
- recuperación frente a cortes de conexión;
- mensajes de error comprensibles;
- confirmación inequívoca;
- información sobre si el material quedó publicado, pendiente o rechazado;
- accesibilidad mediante teclado, contraste y etiquetas apropiadas.

### 9.3 Después de cargar

El invitado puede, según configuración:

- cargar más contenido;
- abrir la galería;
- dejar una dedicatoria;
- reaccionar a fotos;
- ver contenido destacado;
- compartir el enlace del evento;
- consultar datos del evento;
- regresar a la portada.

No se debe obligar al invitado a entregar datos comerciales para subir fotos. Cualquier captación de contacto debe ser voluntaria, clara y separada.

---

## 10. Moderación automática obligatoria mediante inteligencia artificial

La moderación automática forma parte del núcleo obligatorio del lanzamiento. Ninguna fotografía aportada por invitados debe aparecer directamente en la galería pública o en la pantalla sin completar primero el análisis automático.

El servicio recomendado inicialmente es **Amazon Rekognition**, utilizando `DetectModerationLabels`. Claude deberá verificar la infraestructura real de DNX Suite, disponibilidad regional, seguridad, latencia, credenciales y precios vigentes antes de integrarlo. La integración debe quedar desacoplada mediante una interfaz de proveedor para poder sustituir Amazon o incorporar otro servicio sin reescribir el flujo completo.

### 10.1 Volumen y costo esperado

El supuesto comercial inicial es de aproximadamente **100 fotografías por evento**. Con el precio de referencia publicado para el primer tramo de Amazon Rekognition —aproximadamente USD 0,001 por imagen—, la moderación costaría cerca de **USD 0,10 por evento**.

Referencias de volumen:

| Eventos mensuales | Fotografías estimadas | Costo aproximado de moderación |
|---:|---:|---:|
| 10 | 1.000 | USD 1 |
| 50 | 5.000 | USD 5 |
| 100 | 10.000 | USD 10 |
| 500 | 50.000 | USD 50 |
| 1.000 | 100.000 | USD 100 |

Estos importes son orientativos, deben validarse al implementar y no incluyen almacenamiento, transferencia, procesamiento multimedia ni impuestos. Por su bajo costo, la moderación automática estará incluida en todos los eventos y no se venderá inicialmente como adicional.

### 10.2 Flujo obligatorio

1. El invitado selecciona y envía una fotografía.
2. El sistema valida tipo, tamaño y seguridad básica del archivo.
3. El original se guarda de manera privada y nunca queda publicado por defecto.
4. La fotografía entra en estado `PROCESSING` o equivalente según las convenciones reales del repositorio.
5. Se genera, si corresponde, una versión reducida y segura para el análisis.
6. Un trabajo asíncrono e idempotente envía la imagen al proveedor de moderación.
7. Se almacenan proveedor, versión, etiquetas, puntajes, fecha, duración, decisión y política aplicada.
8. El motor de reglas de Subí la Foto traduce el resultado a una decisión de negocio.
9. Si es segura, pasa automáticamente a `APPROVED` y puede publicarse.
10. Si es dudosa, pasa a `REVIEW_REQUIRED`, queda retenida y no se muestra.
11. Si presenta riesgo alto, pasa a `BLOCKED` o `REJECTED` y no se muestra.
12. Si el proveedor falla o no responde, la imagen queda retenida. El sistema debe fallar de manera cerrada: nunca publicar sin análisis.
13. La pantalla y la galería reciben solamente contenidos con decisión final de aprobación.

Los nombres definitivos de estados deben reutilizar las convenciones de DNX Suite y evitar duplicaciones.

### 10.3 Política de decisión

Debe existir una política versionada y configurable que combine etiquetas y niveles de confianza. Como mínimo:

| Resultado | Decisión automática | Visibilidad |
|---|---|---|
| Riesgo bajo | Aprobar | Galería y pantalla |
| Riesgo medio o ambiguo | Retener | Solo panel autorizado |
| Riesgo alto | Bloquear | No público |
| Error técnico o timeout | Retener | No público |

No se debe borrar automáticamente el archivo dudoso o bloqueado. Debe conservarse de manera privada durante el plazo definido para permitir auditoría, reclamo o recuperación autorizada, y luego eliminarse según la política de retención.

### 10.4 Perfiles de moderación

- **Familiar:** umbrales más estrictos; recomendado para escuelas, cumpleaños infantiles y eventos con menores.
- **Social:** equilibrio para bodas, fiestas de quince y cumpleaños de adultos.
- **Empresarial:** política estricta para congresos, empresas e instituciones.
- **Personalizado:** reservado inicialmente a operadores autorizados o una etapa posterior.

El perfil cambia reglas y umbrales, pero nunca permite publicar una imagen sin análisis.

### 10.5 Revisión excepcional

La operación cotidiana no debe depender de un moderador humano. El panel de revisión existe para resolver falsos positivos, reclamos o contenido dudoso. Debe permitir:

- revisar contenidos retenidos;
- aprobar o confirmar el bloqueo;
- ocultar una fotografía ya publicada;
- destacar contenido aprobado;
- ver etiquetas y puntajes de la IA;
- registrar responsable, fecha y motivo de una intervención;
- filtrar por evento, estado, hora y categoría de riesgo;
- revertir una decisión humana dentro de los permisos establecidos.

### 10.6 Controles adicionales

La primera versión debe priorizar desnudez, contenido sexual, violencia, drogas, gestos ofensivos y contenido perturbador según las categorías disponibles. La detección de texto ofensivo dentro de imágenes, control de desenfoque, duplicados y calidad estética puede requerir APIs adicionales. Claude debe estimarlas por separado y no confundirlas con la moderación base.

Ningún proveedor garantiza precisión absoluta. Por eso los casos ambiguos se retienen en lugar de publicarse o eliminarse definitivamente.

---

## 11. Presentación y muro en vivo

La pantalla en vivo es una experiencia central, no una galería web ampliada.

### 11.1 Requisitos

- URL o modo de pantalla exclusivo;
- vista de pantalla completa;
- funcionamiento en televisores, proyectores, notebooks y navegadores modernos;
- actualización en tiempo real;
- emparejamiento sencillo mediante código si se requiere seguridad;
- reconexión automática;
- indicador discreto de estado para el operador;
- precarga de imágenes para transiciones fluidas;
- optimización para conexiones variables;
- evitar que contenido no aprobado aparezca por errores de caché;
- múltiples pantallas simultáneas por evento;
- sincronización razonable entre pantallas;
- modo de contingencia con contenido ya descargado.

### 11.2 Modos visuales

- foto completa;
- mosaico;
- carrusel;
- collage dinámico;
- lluvia o ingreso de miniaturas;
- mensajes y dedicatorias;
- contenido destacado;
- alternancia entre fotos y mensajes;
- placa con QR para incentivar nuevas cargas;
- pausa con portada del evento;
- cierre y agradecimiento.

### 11.3 Control remoto

Desde celular o computadora, el operador debe poder:

- iniciar y detener;
- pausar;
- avanzar o retroceder;
- destacar una foto;
- ocultar una foto inmediatamente;
- cambiar de modo;
- mostrar u ocultar el QR;
- cambiar velocidad;
- activar o silenciar reacciones;
- mostrar una placa especial;
- comprobar pantallas conectadas.

---

## 12. Galería y álbum digital

- diseño coherente con la plantilla;
- vista cronológica;
- mosaico adaptable;
- filtros por tipo de contenido;
- fotos destacadas;
- reproducción de videos;
- mensajes asociados cuando corresponda;
- reacciones configurables;
- carga progresiva;
- enlace compartible según privacidad;
- descargas individuales;
- descarga masiva para usuarios autorizados;
- archivos originales y versiones web correctamente diferenciados;
- álbum disponible durante el período contratado;
- aviso antes del vencimiento;
- posibilidad futura de ampliar almacenamiento o permanencia;
- eliminación y denuncia;
- metadatos sensibles tratados conforme a la política definida.

### 12.1 Preparación automática del paquete final

Al finalizar la ventana activa de 12 horas, el sistema debe consolidar el evento. Cuando la descarga fue comprada:

1. espera a que terminen cargas y moderaciones iniciadas dentro del horario válido;
2. selecciona solamente los archivos que correspondan según la política del producto;
3. genera un manifiesto del contenido;
4. prepara uno o varios archivos compactados, evitando límites de tamaño inviables;
5. calcula integridad y registra cantidad de elementos y tamaño;
6. almacena el paquete de forma privada;
7. genera un enlace firmado, revocable y con vencimiento;
8. envía automáticamente el email al cliente al día siguiente del evento;
9. permite regenerar el enlace sin volver a cobrar mientras el derecho de descarga siga vigente;
10. registra creación, email, accesos y descargas.

El archivo no debe adjuntarse al email. El email contiene un enlace seguro hacia una página de descarga. Si el paquete es grande, puede dividirse en partes claramente identificadas.

### 12.2 Cliente que todavía no compró la descarga

El sistema no debe generar innecesariamente el ZIP completo para todos los eventos. Puede mantener los originales privados durante el período comercial y generar el paquete después del pago.

Cuando el cliente intenta descargar sin haber comprado:

- ve una explicación del adicional;
- conoce el precio final;
- puede pagar;
- tras la confirmación, comienza la generación;
- recibe un email cuando el paquete está listo;
- si la generación demora, la página muestra un estado real y nunca finge que el archivo ya está disponible.

### 12.3 Conservación y eliminación

Para clientes que no compraron el adicional, el contenido se conservará temporalmente hasta el vencimiento informado, inicialmente **30 días posteriores al evento**. Cumplido el plazo y la gracia técnica definida:

- se bloquea una nueva compra si ya no puede cumplirse;
- se revocan enlaces pendientes;
- se programa la eliminación segura de originales y paquetes;
- se conserva solamente la auditoría mínima necesaria, sin mantener las fotografías;
- se registra el resultado de la eliminación;
- se informa correctamente si una copia está sujeta a backups con ciclo de expiración propio.

La compra del adicional debe definir cuánto tiempo permanece disponible el paquete descargable y cuántas regeneraciones permite. Este plazo no debe quedar implícito.

### 12.4 Permisos de descarga y prevención de bypass

Claude debe diferenciar claramente entre:

- visualizar y moderar contenido;
- descargar una imagen individual de trabajo;
- exportar todos los originales;
- adquirir el paquete final del cliente.

Si el paquete completo es un adicional cuyo ingreso corresponde a Subí la Foto, los permisos del fotógrafo no deben permitir que el flujo comercial sea evitado accidentalmente mediante una descarga masiva equivalente. Debe definirse qué acceso operativo necesita realmente el profesional y qué derecho adquiere el cliente. Esta regla debe ser visible, coherente y aceptada antes de vender el servicio.

---

## 13. Fotografías profesionales e integración futura con Comprame la Foto

El modelo debe permitir diferenciar:

- contenido aportado por invitados;
- contenido oficial del fotógrafo;
- contenido del organizador;
- material importado después del evento.

En una etapa posterior se podrá integrar con Comprame la Foto para:

- publicar fotografías profesionales;
- separar vistas previas y originales;
- buscar fotos por reconocimiento facial cuando esté permitido;
- comprar archivos digitales;
- pedir impresiones o productos;
- aplicar marcas de agua y políticas de protección;
- combinar el álbum colaborativo con la galería comercial.

Esta integración no debe bloquear el MVP del 10 de octubre.

---

## 14. Captación de proveedores y construcción de la red comercial

Esta función sí forma parte de la visión inicial. No es todavía un módulo de sponsors.

### 14.1 Objetivo

Permitir que el fotógrafo u organizador comparta con los proveedores de esa noche un enlace específico para que completen sus datos. Cada evento se convierte así en una oportunidad de conocer empresas y profesionales reales que ya trabajan en el sector.

Con el tiempo, DNX Suite contará con una base valiosa, ordenada y reutilizable de proveedores de eventos sociales, congresos y eventos empresariales.

### 14.2 Flujo

1. El creador abre “Proveedores del evento”.
2. Genera un enlace general o enlaces por categoría.
3. Lo comparte por WhatsApp, email o QR.
4. El proveedor abre una página identificada con el evento.
5. Completa sus datos y autoriza el uso correspondiente.
6. El sistema busca posibles duplicados antes de crear una empresa nueva.
7. La ficha queda vinculada al evento y a quien realizó la invitación.
8. Un administrador puede revisar, corregir, fusionar o aprobar la información.
9. La empresa pasa a la base común de proveedores según reglas de calidad y consentimiento.

### 14.3 Datos del proveedor

- nombre comercial;
- razón social, opcional según finalidad;
- CUIT, opcional y protegido;
- categoría y subcategoría;
- descripción;
- nombre de contacto;
- rol del contacto;
- teléfono;
- WhatsApp;
- email;
- sitio web;
- Instagram y otras redes;
- localidad;
- provincia;
- país;
- área de cobertura;
- logo;
- imágenes de trabajos, en etapa posterior;
- servicios ofrecidos;
- observaciones;
- evento desde el cual fue incorporado;
- usuario que lo invitó;
- consentimiento para ser contactado;
- consentimiento separado para recibir oportunidades o novedades;
- fecha y origen de cada consentimiento;
- estado de revisión;
- posibles duplicados.

### 14.4 Categorías sugeridas

- fotografía;
- video;
- salón y locación;
- catering;
- barra y bebidas;
- pastelería;
- DJ;
- sonido;
- iluminación;
- pantallas y técnica;
- streaming;
- ambientación;
- decoración floral;
- mobiliario;
- cotillón;
- maquillaje y peinado;
- vestuario;
- invitaciones y gráfica;
- imprenta;
- cabina y experiencias fotográficas;
- música y espectáculos;
- animación;
- transporte;
- alojamiento;
- seguridad;
- acreditaciones;
- prensa y comunicación;
- organizador de eventos;
- productor de congresos;
- expositor;
- institución o cámara;
- tecnología;
- otros.

### 14.5 Base única y prevención de duplicados

No se debe crear una base aislada por evento ni copiar la misma empresa muchas veces. Se debe analizar la reutilización o extensión del modelo de empresas de DNX Partners.

Una empresa puede estar vinculada a muchos eventos, fotógrafos y workspaces. Los datos globales verificables pueden ser comunes, mientras que notas privadas, relación comercial, etiquetas y contexto deben respetar el ámbito y permisos de cada workspace.

El sistema debe contemplar coincidencias por CUIT, dominio, email, teléfono, Instagram, sitio y similitud de nombre. La fusión no debe borrar relaciones ni consentimientos.

### 14.6 Valor futuro

Esta base permitirá posteriormente:

- directorio de proveedores;
- recomendaciones entre profesionales;
- alianzas y beneficios;
- oportunidades comerciales;
- invitaciones a participar en nuevos eventos;
- búsqueda geográfica por servicio;
- paquetes conjuntos;
- sponsors y campañas;
- métricas del ecosistema;
- conexión con DNX Partners y FotoOffice.

Estas posibilidades futuras no autorizan a utilizar los datos para publicidad sin el consentimiento correspondiente.

---

## 15. Congresos y eventos empresariales

Subí la Foto debe contemplar necesidades más formales:

- identidad corporativa;
- agenda o programa básico;
- múltiples jornadas;
- múltiples salas o actividades;
- QR general y QR por sala;
- álbumes o canales separados;
- carga de asistentes, prensa, organización y fotógrafos;
- moderación reforzada;
- portada con empresas e instituciones;
- mensajes institucionales;
- muro social interno;
- fotografías por charla, jornada o expositor;
- datos de proveedores técnicos;
- exportación ordenada para prensa y comunicación;
- permisos de descarga diferenciados;
- enlaces con vencimiento;
- auditoría de contenido;
- textos y consentimientos adaptables a la finalidad empresarial.

Funciones como acreditación, check-in, encuestas, trivias, preguntas a disertantes, networking y sponsors pueden añadirse después. No deben desplazar la excelencia del núcleo fotográfico inicial.

---

## 16. Panel del profesional

### 16.1 Inicio

- eventos recientes;
- próximos eventos;
- borradores pendientes;
- ventas;
- pagos y liquidaciones;
- alertas operativas;
- almacenamiento utilizado;
- proveedores captados;
- accesos rápidos.

### 16.2 Gestión de eventos

- crear;
- duplicar;
- editar;
- previsualizar;
- enviar propuesta;
- activar según permisos;
- archivar;
- cancelar;
- buscar y filtrar;
- consultar estado comercial y técnico;
- invitar colaboradores;
- acceder a QR, galería, moderación y pantalla.

### 16.3 Métricas por evento

- participantes estimados y únicos;
- cantidad de fotos y videos;
- cargas pendientes, aprobadas y rechazadas;
- actividad por horario;
- visualizaciones de portada y galería;
- escaneos o accesos;
- descargas;
- pantallas conectadas;
- proveedores invitados y registrados;
- almacenamiento y transferencia consumidos;
- incidencias.

Las métricas deben distinguir personas, sesiones y dispositivos cuando sea posible, sin fingir exactitud ni recurrir a seguimiento invasivo.

---

## 17. Panel del cliente

Según permisos, el cliente podrá:

- completar información del evento;
- elegir entre plantillas habilitadas;
- cambiar portada;
- aprobar la apariencia;
- pagar;
- invitar moderadores;
- ver la galería;
- destacar u ocultar contenido;
- descargar materiales;
- acceder a QR imprimibles;
- consultar proveedores registrados;
- pedir soporte.

El panel del cliente debe ser más simple que el panel profesional.

---

## 18. QR y materiales para el evento

- QR único y seguro;
- regeneración controlada;
- URL corta y legible;
- descarga en PNG, SVG o PDF si la infraestructura lo permite;
- versiones para pantalla, mesa, cartel, historia y publicación;
- QR integrado con la plantilla;
- instrucciones editables;
- prueba de lectura antes de descargar;
- código alternativo escrito;
- QR separado para invitados, proveedores, moderadores y pantalla cuando corresponda;
- analítica por origen o pieza sin exponer datos personales innecesarios.

---

## 19. Notificaciones y comunicaciones

- confirmación de registro;
- verificación de email;
- propuesta enviada;
- pago pendiente;
- pago confirmado;
- evento activado;
- recordatorio previo;
- instrucciones operativas;
- invitación a colaborador;
- proveedor invitado;
- proveedor registrado;
- evento próximo a cerrar;
- álbum disponible;
- paquete de descarga disponible;
- descarga aún no contratada: recordatorios de día 1, 3, 7, 15 y 30;
- último aviso con vencimiento exacto;
- confirmación de compra del adicional;
- paquete en preparación;
- enlace de descarga regenerado;
- almacenamiento próximo al límite;
- solicitud de eliminación;
- incidente o acción administrativa.

Reutilizar el sistema de comunicaciones de DNX Suite y sus firmas por workspace si resulta compatible. Evitar notificaciones duplicadas y permitir preferencias.

---

## 20. Administración global

- usuarios y organizaciones;
- eventos;
- configuración de comisiones;
- límites y funcionalidades;
- plantillas;
- categorías;
- proveedores y duplicados;
- pagos, devoluciones y disputas;
- moderación y denuncias;
- almacenamiento;
- métricas globales;
- auditoría;
- soporte e incidencias;
- feature flags;
- textos legales versionados;
- configuración de emails;
- estados de servicios externos;
- capacidad de bloquear un evento sin destruir datos.

Toda acción sensible debe exigir permisos y quedar registrada.

---

## 21. Seguridad, privacidad y aspectos legales

Claude debe elaborar una propuesta que luego pueda revisarse legalmente. Como mínimo:

- autorización clara para cargar contenido;
- declaración de que quien carga debe tener derecho a hacerlo;
- consentimiento diferenciado para aparición pública, uso promocional y contacto comercial;
- mecanismo para solicitar baja;
- política específica cuando participen menores;
- control de acceso a originales;
- URLs no predecibles;
- almacenamiento privado por defecto;
- cifrado en tránsito;
- secretos fuera del repositorio;
- validación de tipos y tamaños;
- análisis de archivos potencialmente dañinos;
- rate limiting;
- protección contra spam y automatización abusiva;
- control de sesión y permisos;
- auditoría de acciones;
- política de retención;
- eliminación lógica y física conforme al ciclo definido;
- respaldo y recuperación;
- exportación de datos cuando corresponda;
- registro de versión de términos aceptados;
- tratamiento correcto de EXIF y geolocalización;
- protección frente a enumeración de eventos;
- cumplimiento de normativa aplicable en Argentina y mercados futuros.

No prometer “bloqueo total de capturas”, porque una imagen visible en una pantalla siempre puede fotografiarse o capturarse. Aplicar medidas razonables solamente cuando el caso lo requiera.

---

## 22. Rendimiento, disponibilidad y operación

- carga rápida en redes móviles;
- imágenes responsive;
- derivados optimizados;
- procesamiento asíncrono;
- colas con reintentos e idempotencia;
- cargas reanudables cuando sea viable;
- almacenamiento desacoplado del servidor web;
- CDN o mecanismo equivalente según infraestructura real;
- actualización en tiempo real con reconexión;
- observabilidad de errores y latencia;
- alertas operativas;
- métricas de colas y procesamiento;
- pruebas de carga;
- límites configurables;
- degradación elegante si falla una función no esencial;
- estrategia ante pérdida temporal de internet en el salón;
- restauración probada;
- páginas de error útiles para usuarios no técnicos.

Objetivos iniciales a validar técnicamente:

- que el acceso a la portada se sienta inmediato;
- que una carga confirmada nunca desaparezca silenciosamente;
- que una foto aprobada llegue a la pantalla en pocos segundos bajo condiciones normales;
- que una reconexión no duplique contenido;
- que una pantalla pueda continuar con contenido precargado durante un corte breve.

---

## 23. Accesibilidad y calidad de experiencia

- contraste suficiente;
- textos ampliables;
- botones grandes;
- foco visible;
- navegación básica por teclado;
- etiquetas para lectores de pantalla;
- mensajes que no dependan solamente del color;
- estados de carga anunciados;
- respeto por reducción de movimiento;
- formularios con errores ubicados y explicados;
- lenguaje simple;
- pruebas en Android e iOS reales;
- pruebas en navegadores integrados de WhatsApp e Instagram cuando sea relevante.

---

## 24. Arquitectura a investigar dentro de DNX Suite

Claude debe inspeccionar y recomendar, sin asumir previamente:

- ubicación de la nueva app en el monorepo;
- estrategia de dominio y subdominios;
- autenticación compartida;
- multi-tenancy y workspaces;
- sistema de roles y permisos;
- modelos comunes de usuario, empresa y contacto;
- almacenamiento y procesamiento multimedia;
- generación de QR;
- tiempo real;
- pagos y split 1:N;
- notificaciones;
- auditoría;
- analítica;
- feature flags;
- diseño y componentes compartidos;
- integración con DNX Partners para la base de empresas, sin activar sponsors;
- integración futura con Comprame la Foto;
- política de migraciones;
- despliegue y rollback.

El informe técnico deberá indicar para cada capacidad:

| Capacidad | Reutilizar | Extender | Crear | Riesgo | Evidencia en repositorio |
|---|---|---|---|---|---|
| Autenticación | | | | | |
| Workspaces | | | | | |
| Pagos | | | | | |
| Multimedia | | | | | |
| Tiempo real | | | | | |
| Plantillas | | | | | |
| Empresas/proveedores | | | | | |
| Comunicaciones | | | | | |
| Auditoría | | | | | |

---

## 25. Modelo conceptual de datos

El modelo definitivo debe surgir del análisis del repositorio. Conceptualmente serán necesarias entidades equivalentes a:

- aplicación o producto;
- workspace/organización;
- perfil profesional;
- evento;
- tipo de evento;
- configuración del evento;
- plantilla;
- versión o personalización de plantilla;
- portada y recursos visuales;
- participante o sesión invitada;
- contenido multimedia;
- derivado multimedia;
- mensaje;
- reacción;
- decisión de moderación;
- pantalla y sesión de pantalla;
- colaborador y permiso;
- QR/enlace de acceso;
- propuesta comercial;
- orden y pago;
- comisión y liquidación;
- consentimiento;
- solicitud de eliminación;
- proveedor/empresa;
- contacto de proveedor;
- vínculo proveedor-evento;
- invitación a proveedor;
- categoría de proveedor;
- auditoría;
- notificación;
- métrica o evento analítico.

Evitar almacenar datos globales del proveedor dentro del vínculo con cada evento. Separar la identidad común de la empresa de la relación contextual.

---

## 26. Alcance obligatorio para el 10 de octubre de 2026

La fecha objetivo está muy próxima. La excelencia requiere limitar el lanzamiento a un núcleo completo, probado y presentable.

### 26.1 Debe funcionar

- identidad Subí la Foto;
- aplicación integrada correctamente en DNX Suite;
- registro e inicio de sesión del profesional;
- panel básico;
- enlace permanente y personalizado de venta para cada profesional;
- compra previa a la configuración del evento;
- creación automática del evento después del pago confirmado;
- creación y edición de eventos;
- tipos de evento principales;
- biblioteca inicial de plantillas de buena calidad;
- foto de portada personalizable;
- previsualización móvil y pantalla;
- modo DEMO anterior a la activación, identificado y separado del contenido real;
- activación programada durante 12 horas consecutivas;
- cierre automático de cargas al finalizar la ventana;
- QR y enlace de invitado;
- carga de múltiples fotos desde celular sin cuenta;
- aceptación de términos;
- almacenamiento seguro;
- moderación automática obligatoria mediante Amazon Rekognition o proveedor equivalente aprobado;
- publicación automática de contenido seguro;
- retención automática de contenido dudoso;
- bloqueo automático de contenido de alto riesgo;
- panel de revisión excepcional para falsos positivos;
- galería de contenido aprobado;
- presentación en vivo estable;
- control básico de pantalla;
- permisos de descarga diferenciados, sin permitir que una exportación operativa evite el adicional del cliente;
- registro obligatorio del email del cliente comprador;
- adicional de descarga configurable, sugerido inicialmente en 15% del precio base;
- asignación del 100% del adicional de descarga a Subí la Foto;
- preparación asíncrona de archivos compactados;
- entrega mediante enlace seguro por email al día siguiente;
- recordatorios automáticos si no se compró la descarga;
- conservación comercial inicial durante 30 días y eliminación posterior controlada;
- enlace para proveedores;
- formulario y vínculo proveedor-evento;
- detección básica de duplicados;
- flujo comercial y de pago definido e implementado solamente si la integración real está homologada;
- emails esenciales;
- auditoría mínima;
- métricas operativas básicas;
- tratamiento de errores;
- pruebas en dispositivos reales;
- monitoreo y procedimiento de soporte.

### 26.2 Puede postergarse si pone en riesgo la fecha

- videos;
- reconocimiento facial;
- venta de fotografías;
- impresiones y kiosco;
- trivias;
- encuestas;
- sorteos;
- RSVP;
- mesas;
- streaming;
- múltiples salas complejas;
- marca blanca;
- editor visual completamente libre;
- plantillas creadas por usuarios;
- aplicación nativa;
- sponsors y campañas;
- directorio público de proveedores;
- recomendaciones automáticas;
- integraciones externas no esenciales.

---

## 27. Cronograma inverso propuesto

### Etapa 0 — Definición y auditoría: 11 al 13 de septiembre

- inspeccionar el monorepo;
- confirmar arquitectura y reutilización;
- definir alcance cerrado del lanzamiento;
- resolver pagos, almacenamiento, tiempo real y empresas;
- producir mapa de recorridos y modelo de datos;
- crear backlog y criterios de aceptación;
- identificar bloqueos externos.

**Salida:** plan técnico aprobado, sin incertidumbres críticas escondidas.

### Etapa 1 — Base funcional: 14 al 20 de septiembre

- nueva app y navegación;
- autenticación;
- roles mínimos;
- modelo de evento;
- asistente de creación;
- plantillas iniciales;
- portada;
- QR y enlaces;
- configuración de privacidad;
- infraestructura multimedia básica.

**Salida:** se crea un evento y se abre su experiencia pública desde un celular.

### Etapa 2 — Núcleo en vivo: 21 al 27 de septiembre

- carga múltiple;
- estados y errores;
- integración de moderación automática;
- políticas y umbrales por tipo de evento;
- estados seguro, dudoso, bloqueado y error;
- panel de revisión excepcional;
- galería;
- tiempo real;
- pantalla 16:9;
- control remoto básico;
- descarga del propietario;
- observabilidad inicial.

**Salida:** recorrido completo QR → carga → análisis automático → publicación o retención → pantalla.

### Etapa 3 — Comercial y proveedores: 28 de septiembre al 2 de octubre

- enlace permanente de venta del profesional;
- compra anterior a la configuración;
- creación automática del evento pagado;
- integración de pago disponible;
- comisión configurable;
- activación segura;
- adicional de descarga con ingreso 100% para la plataforma;
- checkout posterior y recuperación de compra;
- generación asíncrona de paquete y enlace seguro;
- emails de entrega y recordatorios;
- ciclo de retención y eliminación;
- emails;
- enlace de proveedores;
- formulario;
- base compartida y vínculos;
- detección de duplicados;
- métricas básicas.

**Salida:** evento vendible y captura real de proveedores.

### Etapa 4 — Estabilización: 3 al 7 de octubre

- pruebas end-to-end;
- dispositivos reales;
- navegadores móviles;
- pruebas de carga;
- recuperación de conexión;
- permisos y privacidad;
- accesibilidad;
- corrección de errores;
- validación de plantillas;
- documentación operativa;
- backups y rollback.

**Salida:** candidato de lanzamiento sin fallos críticos ni altos conocidos.

### Etapa 5 — Ensayo y lanzamiento: 8 al 10 de octubre

- ensayo general con evento real o simulado;
- congelamiento de funcionalidades;
- corrección exclusiva de bloqueantes;
- verificación de producción;
- monitoreo;
- soporte preparado;
- lanzamiento controlado.

**Salida:** Subí la Foto funcionando con excelencia el 10 de octubre de 2026.

---

## 28. Recorrido crítico de aceptación

El lanzamiento no debe aprobarse hasta demostrar este recorrido:

1. Un fotógrafo crea su cuenta.
2. Configura su enlace permanente de venta.
3. Un cliente registra su email y paga desde ese enlace.
4. El sistema crea automáticamente el evento pagado.
5. El fotógrafo comienza la configuración recién después del pago.
6. Selecciona una plantilla.
7. Cambia la portada, configura la activación y verifica las 12 horas calculadas.
8. Prueba móvil, QR, moderación y pantalla en modo DEMO sin iniciar la ventana real.
9. Genera el QR definitivo.
10. Antes del horario, el QR definitivo no habilita cargas públicas.
11. En el horario exacto, el evento se activa automáticamente.
12. Un invitado lo escanea desde un celular real.
13. Acepta condiciones y carga varias fotos.
14. La carga sobrevive a una conexión imperfecta sin perderse ni duplicarse.
15. La IA analiza automáticamente cada fotografía.
16. Las imágenes seguras se aprueban sin intervención humana.
17. Las imágenes dudosas quedan retenidas y las de alto riesgo quedan bloqueadas.
18. Si el servicio de IA falla, ninguna imagen pendiente se publica.
19. Solamente las aprobadas aparecen en galería y pantalla.
20. El operador pausa, avanza y oculta contenido.
21. El fotógrafo puede revisar y recuperar un falso positivo con auditoría.
22. A las 12 horas exactas se cierran automáticamente las nuevas cargas.
23. Si el cliente compró la descarga, recibe al día siguiente un enlace seguro al paquete.
24. Si no la compró, recibe la secuencia de recordatorios sin duplicados y puede pagar posteriormente.
25. Después del pago tardío, el paquete se genera y se entrega automáticamente.
26. Al vencer el plazo sin compra, se bloquea la venta y se elimina el contenido conforme a la política.
27. El fotógrafo envía el enlace de proveedores.
28. Un proveedor completa su ficha.
29. La empresa queda vinculada al evento sin duplicar indebidamente una existente.
30. Todas las acciones sensibles quedan auditadas.
31. El sistema explica correctamente cualquier error y permite recuperarse.

---

## 29. Estrategia de pruebas

- pruebas unitarias para reglas críticas;
- pruebas de integración para base de datos, almacenamiento, pagos y permisos;
- pruebas end-to-end de los recorridos principales;
- pruebas de webhook e idempotencia;
- pruebas de múltiples cargas simultáneas;
- pruebas de archivos grandes, inválidos y duplicados;
- pruebas de moderación automática concurrente;
- conjunto de imágenes de prueba seguras, dudosas y bloqueables;
- pruebas de umbrales por perfil de evento;
- pruebas de falsos positivos y revisión excepcional;
- pruebas de timeout, error, reintento e idempotencia del proveedor de IA;
- prueba explícita de que el sistema nunca publica contenido no analizado;
- pruebas de reconexión de pantalla;
- pruebas de enlaces vencidos o revocados;
- pruebas de acceso entre workspaces;
- pruebas de eliminación y auditoría;
- pruebas visuales de plantillas;
- pruebas manuales en iPhone y Android;
- Safari, Chrome y navegadores embebidos;
- prueba en televisión/proyector 16:9;
- ensayo de evento con carga sostenida;
- simulación de caída parcial de servicios;
- prueba de restauración y rollback.

El objetivo no debe expresarse solamente como porcentaje de cobertura. Se deben verificar recorridos y riesgos reales.

---

## 30. Criterios de lanzamiento

- cero errores críticos abiertos;
- cero vulnerabilidades críticas conocidas;
- cero cruces de datos entre eventos o workspaces;
- pagos reconciliados si están habilitados;
- cargas sin pérdida silenciosa;
- moderación y pantalla estables;
- plantillas verificadas en móvil y 16:9;
- textos legales y consentimientos presentes;
- eliminación y soporte operativos;
- métricas y alertas activas;
- backups y rollback documentados;
- responsables definidos para incidentes;
- ensayo integral aprobado.

---

## 31. Riesgos principales

### Plazo

El 10 de octubre exige congelar el alcance. Cada función incorporada después del cierre debe reemplazar otra o pasar al backlog posterior.

### Pagos

La homologación o disponibilidad de split 1:N puede depender de terceros. Preparar un plan permitido y claramente documentado si no estuviera disponible, sin simular una distribución automática inexistente.

### Multimedia

Fotos y videos pueden generar costos y picos de transferencia. Establecer límites, derivados y monitoreo desde el inicio.

### Tiempo real

La experiencia del evento ocurre en un momento irrepetible. Reconexión, caché local razonable y control operativo son prioritarios.

### Privacidad

Las fotos pueden incluir menores o personas que no desean aparecer. Los mecanismos de información, moderación y baja deben existir desde la primera versión.

### Base de proveedores

Una base grande pero duplicada, desactualizada o sin consentimientos tiene poco valor y mucho riesgo. La calidad y el origen de datos deben conservarse.

### Exceso de integración

Intentar integrar al mismo tiempo todos los productos DNX puede demorar el lanzamiento. Reutilizar servicios estables y postergar integraciones profundas.

---

## 32. Funciones posteriores al lanzamiento

### Fase posterior 1

- videos;
- mensajes y dedicatorias enriquecidos;
- reacciones;
- más modos de pantalla;
- álbumes por momentos;
- plantillas adicionales;
- marca blanca;
- mejor analítica;
- almacenamiento ampliable.

### Fase posterior 2

- reconocimiento facial con consentimiento;
- moderación asistida por IA;
- selección automática de mejores fotos;
- video resumen;
- integración comercial con Comprame la Foto;
- impresiones y productos;
- kiosco del evento.

### Fase posterior 3

- RSVP;
- check-in;
- mesas;
- agenda avanzada para congresos;
- encuestas;
- trivias;
- sorteos;
- preguntas a disertantes;
- networking.

### Fase posterior 4

- directorio de proveedores;
- recomendaciones;
- alianzas;
- oportunidades comerciales;
- sponsors y campañas mediante DNX Partners;
- exclusividades y categorías publicitarias;
- beneficios cruzados con FotoOffice.

---

## 33. Funciones expresamente fuera del alcance inicial

El lanzamiento inicial no debe incluir un sistema completo de sponsors. La ficha de proveedor sirve para captar, organizar y relacionar empresas y profesionales. No autoriza todavía:

- publicar anuncios automáticamente;
- vender inventario publicitario;
- enviar campañas sin consentimiento;
- ofrecer exclusividad comercial;
- compartir contactos entre workspaces sin reglas;
- mostrar públicamente un directorio;
- calificar proveedores públicamente.

Estas funciones deberán diseñarse en una fase propia y conectarse posteriormente con DNX Partners.

---

## 34. Identidad y mensajes de marca

### Nombre

**Subí la Foto**

### Escritura

- Marca visible: **Subí la Foto**
- Dominio: `subilafoto.com`
- Identificador técnico: definir después de revisar convenciones del repositorio.

### Promesa principal

> Todas las miradas de tu evento, en un solo lugar.

### Mensaje para invitados

> Escaneá. Subí. Compartí.

### Mensaje para profesionales

> Creá eventos gratis, vendelos al precio que quieras y pagá solamente cuando vendés.

### Tono

Simple, cercano, festivo, confiable y profesional. Evitar explicaciones técnicas frente al invitado.

---

## 35. Decisiones confirmadas

- El nombre elegido es **Subí la Foto**.
- El dominio deseado es `subilafoto.com`.
- Será una nueva app de DNX Suite.
- El profesional podrá crear y vender eventos.
- Cada profesional tendrá un enlace permanente de venta.
- El cliente deberá pagar antes de que el fotógrafo configure el evento.
- El sistema creará el evento automáticamente después de confirmar el pago.
- Cada evento se activará en el horario configurado durante 12 horas consecutivas.
- Antes de la activación existirá un modo DEMO separado del evento real.
- El email del cliente comprador será obligatorio para confirmaciones y entrega.
- La descarga final podrá venderse como adicional, inicialmente sugerido en 15% del precio base.
- El 100% del ingreso por el adicional de descarga corresponderá a Subí la Foto.
- Si el adicional fue comprado, el paquete se enviará mediante enlace seguro al día siguiente.
- Si no fue comprado, se enviarán recordatorios en los días 1, 3, 7, 15 y 30.
- Sin compra, el contenido tendrá inicialmente una conservación comercial de 30 días y luego se eliminará de manera controlada.
- El profesional definirá el precio de venta dentro de reglas mínimas.
- La comisión inicial propuesta para la plataforma es 15% y deberá ser configurable.
- El invitado participará mediante QR o enlace, sin instalar una app.
- Todas las fotografías aportadas por invitados pasarán por moderación automática antes de publicarse.
- El proveedor recomendado inicialmente es Amazon Rekognition mediante `DetectModerationLabels`.
- El promedio comercial estimado es de 100 fotografías por evento.
- El costo orientativo de moderación es de USD 0,10 por evento.
- La moderación automática estará incluida en el servicio y no se cobrará como adicional inicialmente.
- Las imágenes seguras se publicarán automáticamente.
- Las imágenes dudosas quedarán retenidas y las de alto riesgo serán bloqueadas.
- Ante un error del servicio de IA, el contenido quedará retenido y nunca se publicará sin análisis.
- Habrá plantillas temáticas y fotografía de portada.
- Se contemplarán eventos sociales, congresos y eventos empresariales.
- El fotógrafo podrá enviar un enlace a los proveedores del evento.
- Los proveedores completarán sus datos y quedarán vinculados al evento.
- Se buscará construir una base común y valiosa de proveedores y empresas.
- Sponsors y monetización publicitaria quedan para una etapa posterior.
- El desarrollo será progresivo.
- La versión prioritaria debe funcionar con excelencia el 10 de octubre de 2026.

---

## 36. Decisiones abiertas que Claude debe presentar para aprobación

- disponibilidad y registro definitivo del dominio;
- estructura jurídica y fiscal de la comisión;
- comisión mínima y precio mínimo;
- responsable del costo del medio de pago;
- disponibilidad real de split 1:N;
- duración incluida del álbum;
- límites de fotos, archivos y almacenamiento;
- umbrales definitivos de cada perfil de moderación después de probarlos con fotografías reales de eventos;
- plazo de conservación privada del contenido retenido o bloqueado;
- inclusión o postergación de video en el lanzamiento;
- cantidad exacta de plantillas iniciales;
- alcance exacto del panel del cliente;
- porcentaje o precio final del adicional de descarga, aunque el valor inicial sugerido es 15%;
- plazo de disponibilidad y cantidad de regeneraciones después de comprar la descarga;
- duración exacta de la gracia técnica posterior al último aviso;
- contenido exacto del paquete: aprobadas, bloqueadas, originales, mensajes y manifiesto;
- estrategia de tiempo real;
- estrategia de almacenamiento y CDN;
- relación técnica exacta con DNX Partners;
- reglas de propiedad y visibilidad de proveedores;
- términos, privacidad y tratamiento de menores;
- dominio principal, subdominios y URLs;
- estrategia de producción, beta controlada y soporte;
- evento real elegido para el ensayo general.

Para cada decisión abierta, Claude debe ofrecer opciones, ventajas, riesgos, costo de implementación, impacto en el 10 de octubre y una recomendación concreta.

---

## 37. Entregables solicitados a Claude

Después de inspeccionar el proyecto, producir dentro de la documentación del repositorio:

1. `README` funcional de Subí la Foto.
2. Especificación de arquitectura real.
3. Mapa de módulos reutilizados y nuevos.
4. Modelo de datos propuesto.
5. Matriz de roles y permisos.
6. Mapa de pantallas.
7. Diagramas de recorridos críticos.
8. Backlog por etapas.
9. Cronograma hasta el 10 de octubre.
10. Criterios de aceptación por historia.
11. Plan de pruebas.
12. Plan de migraciones.
13. Plan de despliegue y rollback.
14. Registro de riesgos.
15. Lista de decisiones abiertas.
16. Informe diario de avance contra el camino crítico.

Claude no debe limitarse a devolver ideas generales. Debe vincular cada recomendación técnica con evidencia encontrada en el repositorio y convertir el alcance aprobado en tareas implementables y verificables.

---

## 38. Orden final de prioridad

1. Seguridad, privacidad y separación correcta de datos.
2. Crear y configurar un evento.
3. Plantillas y portada excelentes.
4. QR y experiencia móvil sin fricción.
5. Carga confiable de fotos.
6. Moderación rápida.
7. Pantalla en vivo estable.
8. Galería y descarga.
9. Venta, comisión y activación segura.
10. Captación ordenada de proveedores.
11. Métricas, auditoría y soporte.
12. Funciones posteriores.

La regla para llegar al 10 de octubre debe ser clara:

> Primero, hacer impecable el recorrido QR → carga → moderación → pantalla → álbum. Después, ampliar.
