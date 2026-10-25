# Serie de demos grabables: qué más se puede mostrar

La demo escolar dejó armada la base para todas las demás: el cuadro guía (`components/demos/CuadroGuia.tsx`),
los guiones (`lib/demos/guiones/`), el cambio de vista, el panel `/admin/demos` y las reglas de
aislamiento (etiqueta `DEMO_PRESENTACION`, correos `.test`, pedidos `isTest`). Una demo nueva es:
datos falsos con su «Preparar» y «Reiniciar», más un guion de pasos.

Ordenadas por cuánto venden y cuánto falta para armarlas.

## ComprameLaFoto (ya tiene la base)

1. **Venta de un evento deportivo o social con reconocimiento facial.** Álbum público, el corredor
   se busca con la selfie o por número de dorsal, compra digitales y paga. Reusa casi todo lo
   escolar. *Esfuerzo: bajo.*
2. **Videos del evento.** Venta de clips con marca de agua, búsqueda por cara en los cuadros del
   video, descarga. *Bajo-medio* (el procesamiento de video tarda: hay que dejarlo hecho).
3. **Laboratorio e impresiones.** El cliente pide copias, el fotógrafo las manda al laboratorio,
   el laboratorio las marca listas. Vistas: cliente, fotógrafo, laboratorio. *Medio.*
4. **Packs cobrados por fuera (Excel de familias).** Importar el Excel, mandar los links por
   WhatsApp, canje y librito. *Bajo.*
5. **El bot del fotógrafo de punta a punta.** Configurar una escuela entera solo conversando.
   *Bajo* (es un guion sobre la demo escolar).
6. **Referidos y comunidad.** Cómo un fotógrafo invita a otro y gana una parte del fee. *Bajo.*
7. **Diseñador de plantillas.** Crear una plantilla desde cero, variables del alumno, mosaico del
   curso, exportar a imprenta. *Bajo.*

## FOTOFFICE (gestión de asociaciones y estudios)

8. **Cuotas y socios de una asociación.** Alta de socio, cuota mensual, cobro por Mercado Pago,
   recordatorio, sorteo verificable entre socios al día. Vistas: comisión directiva y socio. *Medio.*
9. **Sitio público y blog de la asociación** con dominio propio. *Bajo.*
10. **Cursos presenciales.** Publicar un curso, inscripción y pago, lista de alumnos. *Bajo.*
11. **Empresa del fotógrafo.** Consultas, presupuestos, agenda estilo Google Calendar y caja.
    *Medio.*
12. **Reservas de espacios** (estudio, sala). *Medio.*

## Clickatón (maratones fotográficas)

13. **Una edición completa.** Inscripción y pago, kit, consignas que se liberan por reloj (con el
    ensayo de edición y su reloj movible), subida, admisión, jurado, ranking y diplomas. Vistas:
    organizador, participante, jurado. *Medio* (el ensayo de edición ya existe).
14. **Acreditación offline el día del evento.** *Bajo.*
15. **Cupones, regalos de inscripción y referidos.** *Bajo.*

## FotoRank (concursos)

16. **Un concurso de punta a punta.** Bases, inscripción, fotos, jurado con su visor y los tipos
    de calificación, resultados y diplomas. *Medio.*
17. **Bolsa de jurados.** *Bajo* cuando esté terminada.

## SubiLaFoto (fotos de los invitados en eventos sociales)

18. **Un cumpleaños de 15 en vivo.** Los invitados suben fotos con el QR, la pantalla del salón
    las proyecta, moderación, descarga final. Vistas: organizador, invitado, pantalla. *Bajo-medio.*

## DNX Flux / FotoFluxx

19. **Ingesta y filtrado de un evento grande en la nube.** *Medio-alto* (todavía en evolución).

## Recomendación de orden

1. Evento deportivo con selfie (1): reusa todo y tiene el «wow» del reconocimiento facial.
2. Clickatón completo (13): es el producto con más demanda de explicación.
3. SubiLaFoto en un 15 (18): muy visual para mostrar en vivo.
4. Cuotas y sorteo de FOTOFFICE (8): para vender a asociaciones.
