/** Versión con cláusula Info Spot (autorización editorial limitada). */
export const TERMS_VERSION = "2026-07-21";

/**
 * Versiones cuya aceptación sigue habilitando la venta del álbum.
 *
 * Los términos se aceptan **por álbum, al crearlo**, y quedan guardados en
 * `Album.termsVersion`. Un álbum creado bajo una versión anterior fue aceptado de
 * verdad: el fotógrafo leyó ese texto y lo aprobó. Bloquearle la venta no lo hace
 * más correcto, solo frena una venta válida.
 *
 * Por eso la habilitación comercial acepta cualquier versión de esta lista, y no
 * solo la última. Los álbumes nuevos siguen guardando `TERMS_VERSION`.
 *
 * **Cuándo sacar una versión de acá:** si un cambio de términos es materialmente
 * relevante (cede derechos, cambia comisiones, altera responsabilidades), quitala
 * de la lista. Eso corta la venta de los álbumes viejos a propósito y obliga a la
 * re-aceptación. Es una decisión legal, no técnica.
 *
 * `2026-01-26` — versión base, la que aceptaron los álbumes en producción.
 * `2026-07-21` — agrega la cláusula Info Spot (autorización editorial limitada).
 */
export const TERMS_VERSIONS_VALIDAS_PARA_VENTA: readonly string[] = [
  "2026-01-26",
  TERMS_VERSION,
];

export const TERMS_TEXT = `TÉRMINOS Y CONDICIONES – FOTÓGRAFOS (Aceptados al crear un álbum)

1. Titularidad de las fotografías
El fotógrafo declara y acepta que:
- Es el autor y titular exclusivo de los derechos de autor de todas las fotografías que suba a la plataforma.
- La carga de fotografías en ComprameLaFoto NO implica cesión de derechos a la plataforma, al laboratorio ni a terceros.
- Las fotografías siguen siendo propiedad intelectual del fotógrafo en todo momento.

2. Uso de las fotografías dentro de la plataforma
Al crear un álbum, el fotógrafo autoriza a ComprameLaFoto a:
- Mostrar las fotografías en formato previsualización (con marca de agua u otros sistemas de protección).
- Utilizar dichas previsualizaciones exclusivamente para la venta de fotografías digitales y/o impresas dentro de la plataforma.
- Procesar las imágenes necesarias para cumplir con pedidos realizados por clientes (impresión, descarga digital, generación de previews, etc.).
Esta autorización es limitada, no exclusiva y solo para el funcionamiento del servicio.

3. Venta de fotografías y configuración del álbum
El fotógrafo entiende y acepta que:
- Cada álbum permite configurar venta digital, impresa o ambas.
- Los precios, márgenes y laboratorios asociados al álbum son definidos por el fotógrafo dentro de las herramientas disponibles.
- ComprameLaFoto aplica una comisión de plataforma según el modelo vigente.
- Los fondos pueden acreditarse primero en la cuenta de la plataforma y luego transferirse al fotógrafo. Los tiempos de acreditación y transferencia dependen de Mercado Pago.

4. Relación con laboratorios
En caso de habilitar venta de impresiones:
- El fotógrafo autoriza a enviar los archivos necesarios al laboratorio seleccionado para producir copias.
- El laboratorio no adquiere derechos sobre las fotografías, solo autorización para imprimirlas para cumplir el pedido.

5. Info Spot – uso editorial limitado para promover la venta
Al crear o actualizar un álbum y aceptar estos términos, el fotógrafo autoriza a Info Spot (medio editorial administrado por ComprameLaFoto) a:
- Seleccionar un número limitado de fotografías del álbum/galería (el mínimo operativo que la plataforma determine para coberturas editoriales).
- Publicarlas en notas, coberturas y contenidos de Info Spot con crédito al fotógrafo.
- Usar esas imágenes con el fin principal de difundir el evento/cobertura y promover la venta de fotografías del álbum en ComprameLaFoto (incluyendo enlaces de compra).
Esta autorización:
- Es limitada, no exclusiva y no implica cesión de derechos de autor.
- No autoriza reventa ni uso comercial ajeno al ecosistema ComprameLaFoto / Info Spot.
- Puede revocarse para una foto concreta mediante los mecanismos de remoción o gestión editorial disponibles, sin afectar el resto del álbum salvo disposición en contrario.
Las fotografías ya cargadas en álbumes sujetos a estos términos (incluida la aceptación vigente al actualizar ventas) quedan alcanzadas por esta autorización editorial limitada.

6. Responsabilidad sobre derechos de imagen
El fotógrafo declara que cuenta con las autorizaciones necesarias para fotografiar y comercializar las imágenes. ComprameLaFoto actúa como intermediario tecnológico y no es responsable por reclamos derivados del contenido cargado por el fotógrafo.

7. Eliminación de álbumes y contenido
Los álbumes pueden expirar y eliminarse automáticamente. Al eliminarse, las fotografías dejan de estar disponibles para la venta. ComprameLaFoto puede conservar copias técnicas temporales por razones operativas, de seguridad o legales. Los derivados editoriales ya publicados en Info Spot pueden permanecer según la política editorial vigente y el crédito al fotógrafo.

8. Aceptación
Al crear o actualizar un álbum, el fotógrafo declara haber leído, comprendido y aceptado estos Términos y Condiciones.

9. Solicitudes de remoción (derecho de imagen)
ComprameLaFoto ofrece un mecanismo para que terceros soliciten la remoción de una fotografía por razones de derecho de imagen u otros motivos legítimos. El fotógrafo recibirá dichas solicitudes en su panel y podrá aprobar o rechazar la remoción. En caso de aprobación, la foto dejará de estar disponible públicamente y no podrá continuar vendiéndose desde la plataforma. El fotógrafo declara comprender que esta herramienta existe como medida de resguardo legal y de gestión responsable del contenido.`;
