/**
 * Bases y condiciones — BORRADOR LEGAL de "El País que Miramos".
 *
 * Estado: PENDIENTE DE REVISIÓN LEGAL. No publicar.
 *
 * Los marcadores `[[PENDIENTE: …]]` son deliberados: identifican datos legales
 * que NO deben inventarse. Mientras exista alguno, el gate de publicación
 * bloquea el pase a REGISTRATION_OPEN.
 */

/** Marcador administrativo de dato legal faltante. */
export const LEGAL_PLACEHOLDER_PREFIX = "[[PENDIENTE:";

export function contentHasLegalPlaceholder(content: string): boolean {
  return content.includes(LEGAL_PLACEHOLDER_PREFIX);
}

/** Lista de marcadores presentes, para el checklist administrativo. */
export function listLegalPlaceholders(content: string): string[] {
  const matches = content.match(/\[\[PENDIENTE:[^\]]+\]\]/g) ?? [];
  return Array.from(new Set(matches));
}

export const EL_PAIS_QUE_MIRAMOS_RULES_TITLE =
  "Bases y Condiciones — El País que Miramos, Primera Edición 2026 (BORRADOR)";

export const EL_PAIS_QUE_MIRAMOS_RULES_DRAFT = `# BASES Y CONDICIONES — BORRADOR

**ESTADO: BORRADOR LEGAL — PENDIENTE DE REVISIÓN LEGAL — NO PUBLICAR**

## 1. Organización

"El País que Miramos – Primera Edición 2026" es un concurso nacional de fotografía organizado por FotoRank.

Antes de su publicación deberán completarse los siguientes datos, que no pueden inventarse:

- Razón social o persona responsable: [[PENDIENTE: razón social del organizador]]
- CUIT: [[PENDIENTE: CUIT del organizador]]
- Domicilio legal: [[PENDIENTE: domicilio legal del organizador]]
- Correo oficial de contacto: [[PENDIENTE: correo oficial de contacto]]
- Jurisdicción contractual aplicable: [[PENDIENTE: jurisdicción contractual]]

## 2. Objeto

El concurso tiene por finalidad promover la producción fotográfica, reconocer miradas personales sobre la Argentina y construir un registro visual diverso de su territorio, sus habitantes y sus formas de vida.

## 3. Participantes

Podrán participar personas físicas mayores de 18 años, argentinas o extranjeras con residencia en la República Argentina, sean fotógrafos profesionales o aficionados.

No podrán participar integrantes del equipo organizador directamente involucrados en la administración del concurso, miembros del jurado, sus familiares directos ni personas que presenten un conflicto de interés relevante.

La organización podrá requerir documentación razonable para verificar identidad, edad, residencia o autoría.

## 4. Inscripción

La inscripción será individual y se realizará exclusivamente mediante FotoRank.

Cada participante podrá seleccionar una modalidad de una, dos o tres fotografías.

El registro previo mediante "Notificarme" no constituye una inscripción, no reserva un cupo y no obliga a realizar ningún pago.

La inscripción se considerará confirmada únicamente cuando, en una etapa posterior, el sistema de pagos indique que el pago fue aprobado y la participación haya sido correctamente registrada.

Las condiciones definitivas de pago, cancelación y reembolso deberán ser revisadas antes de habilitar DNX Payments: [[PENDIENTE: política de pago, cancelación y reembolso]]

## 5. Precio promocional para interesados

Las personas que hayan solicitado ser notificadas antes del 20 de septiembre de 2026 a las 23:59 podrán acceder a un precio promocional exclusivo entre el 21 de septiembre y el 10 de octubre de 2026, siempre que utilicen la misma cuenta de FotoRank.

El beneficio es personal, no transferible y no acumulable.

El registro de interés no garantiza el precio si el pago no se completa dentro del plazo establecido.

## 6. Obras admitidas

Las fotografías deberán:

- Haber sido realizadas por la persona participante.
- Haber sido tomadas dentro del territorio de la República Argentina.
- Mantener una relación identificable con la consigna.
- Cumplir los requisitos técnicos publicados.
- Presentarse sin firma, nombre, marco, marca de agua o identificación visible del autor.
- Respetar derechos de imagen, propiedad, privacidad y demás derechos de terceros.

Se admitirán fotografías realizadas con cámaras digitales, analógicas digitalizadas o teléfonos móviles, siempre que cumplan los requisitos técnicos.

No se establece inicialmente una fecha mínima de toma. Esta decisión deberá mostrarse claramente antes de publicar las bases definitivas: [[PENDIENTE: decisión sobre fecha mínima de toma]]

## 7. Edición y herramientas generativas

Se admitirán ajustes fotográficos habituales como exposición, contraste, balance de blancos, color, conversión a blanco y negro, recorte, corrección de perspectiva y eliminación de polvo o imperfecciones menores.

No se admitirán:

- Imágenes generadas total o parcialmente mediante inteligencia artificial generativa.
- Incorporación de elementos que no estaban presentes en la escena.
- Sustitución generativa de partes sustanciales.
- Fotomontajes no declarados.
- Contenido fraudulento o cuya autoría no pueda acreditarse.

La organización podrá solicitar archivo original, RAW, negativo, secuencia de captura u otra evidencia razonable a finalistas o ganadores.

La imposibilidad injustificada de acreditar la autoría o el proceso podrá provocar la descalificación.

## 8. Requisitos técnicos

Parámetros configurables, pendientes de validación técnica definitiva:

- Formatos admitidos: JPEG o JPG.
- Perfil de color recomendado: sRGB.
- Tamaño máximo y mínimo: [[PENDIENTE: límites de tamaño según infraestructura vigente]]
- Resolución suficiente para evaluación y eventual impresión.
- Archivo sin marca de agua.
- Conservación del original por parte del autor.

## 9. Derechos de autor

Los participantes conservarán la titularidad de sus obras.

La participación otorgará al organizador una autorización no exclusiva y gratuita, limitada a la difusión cultural, institucional y promocional del concurso, sus resultados, finalistas, catálogo, exhibiciones y futuras comunicaciones vinculadas con el certamen.

Toda utilización deberá acreditar al autor cuando el contexto lo permita.

La autorización no implicará venta, cesión exclusiva ni transferencia de la propiedad intelectual.

Cualquier utilización comercial ajena a la promoción del concurso requerirá una autorización adicional.

La duración, alcance territorial y medios concretos de esta licencia deberán ser revisados legalmente antes de publicar: [[PENDIENTE: duración, alcance territorial y medios de la licencia]]

## 10. Derechos de imagen y terceros

La persona participante declara contar con las autorizaciones necesarias cuando la fotografía incluya personas identificables, propiedades privadas, obras protegidas, menores de edad u otros elementos sujetos a derechos de terceros.

Cuando corresponda, FotoRank podrá requerir documentación de respaldo.

Las reglas específicas para imágenes de menores deberán revisarse legalmente antes de publicar: [[PENDIENTE: reglas para imágenes de personas menores de edad]]

## 11. Admisión

La admisión verificará:

- Cumplimiento técnico.
- Relación mínima con la consigna.
- Ausencia de marcas identificatorias.
- Elegibilidad del participante.
- Ausencia de contenidos manifiestamente ilícitos.
- Cumplimiento de autoría y restricciones de inteligencia artificial.

La admisión técnica no implica valoración artística ni garantiza la selección.

Toda exclusión debe registrar un motivo.

## 12. Jurado

El jurado estará compuesto por tres integrantes cuyos nombres y antecedentes deberán publicarse antes de la apertura de inscripciones: [[PENDIENTE: integrantes del jurado]]

Las obras serán evaluadas anónimamente.

Las decisiones del jurado se registrarán mediante FotoRank y se documentarán en un acta final.

Los mecanismos de desempate y declaración de premios desiertos deberán definirse antes de la publicación definitiva: [[PENDIENTE: mecanismo de desempate y premios desiertos]]

## 13. Evaluación

Las obras serán evaluadas conforme a:

- Potencia narrativa y emocional: 30%.
- Originalidad y mirada personal: 25%.
- Relación con la consigna: 20%.
- Composición y construcción visual: 15%.
- Resolución técnica: 10%.

El Gran Premio será determinado por mérito fotográfico y decisión del jurado, nunca mediante sorteo o azar.

## 14. Premio del Público

El Premio del Público será independiente del Gran Premio y de los premios determinados por el jurado.

Su implementación deberá incluir mecanismos razonables para prevenir fraude, votos automatizados, cuentas duplicadas y manipulación.

La organización podrá invalidar votos fraudulentos dejando registro de la decisión.

## 15. Premios

El Gran Premio consistirá en una cámara mirrorless APS-C nueva, con lente kit, cuyo modelo, garantía, proveedor y valor de referencia serán publicados antes de la apertura de inscripciones: [[PENDIENTE: modelo, garantía, proveedor y valor de referencia del premio]]

Si por razones comprobables de disponibilidad el modelo anunciado no pudiera entregarse, solamente podrá reemplazarse por un producto de prestaciones y valor iguales o superiores, de acuerdo con las bases definitivas y la normativa aplicable.

Los datos del premio no podrán modificarse silenciosamente después de abrir las inscripciones. Cualquier cambio debe quedar versionado, justificado y comunicado.

## 16. Cronograma

- Apertura prevista: 21 de septiembre de 2026.
- Fin del precio promocional: 10 de octubre de 2026.
- Cierre definitivo: 5 de diciembre de 2026.
- Admisión: 6 al 8 de diciembre.
- Evaluación: 9 al 15 de diciembre.
- Deliberación: 16 y 17 de diciembre.
- Finalistas: 18 de diciembre.
- Resultados y entrega prevista: 21 de diciembre de 2026.

Todas las fechas corresponden al huso horario America/Argentina/Buenos_Aires.

## 17. Entrega

La modalidad de entrega, envío, seguro, costos, documentación, garantía y plazo para reclamar el premio deberán completarse antes de publicar: [[PENDIENTE: modalidad de entrega, seguro, costos y plazo de reclamo]]

El ganador deberá acreditar su identidad y cumplir los requisitos razonables de recepción.

No debe exigirse al ganador un pago inesperado para recibir el premio.

## 18. Cancelación, modificación y fuerza mayor

Las condiciones de cancelación, postergación, reprogramación y reembolso deberán definirse antes de habilitar pagos y deberán cumplir la normativa de consumo aplicable: [[PENDIENTE: condiciones de cancelación, postergación y reembolso]]

La organización no podrá reservarse facultades ilimitadas ni modificar elementos esenciales sin una causa objetiva, comunicación y tratamiento adecuado de las inscripciones existentes.

## 19. Datos personales y comunicaciones

Los datos serán utilizados para administrar el concurso, verificar la participación, realizar comunicaciones operativas y cumplir obligaciones legales.

Las comunicaciones promocionales requerirán consentimiento específico o general válido.

La persona podrá cancelar comunicaciones promocionales sin afectar los mensajes operativos indispensables de una participación ya confirmada.

Antes de publicar deberán completarse: [[PENDIENTE: responsable de tratamiento, finalidad, política de privacidad y ejercicio de derechos]]

## 20. Aceptación

La inscripción definitiva implicará la aceptación de las bases vigentes y publicadas al momento del pago, sin perjuicio de los derechos inderogables que correspondan al consumidor.

El sistema deberá registrar la versión exacta aceptada por cada participante.

FIN DEL BORRADOR DE BASES.
`;
