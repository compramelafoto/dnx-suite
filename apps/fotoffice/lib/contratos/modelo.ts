/**
 * Texto base de la plantilla "Contrato de eventos (modelo)" que se siembra en DNX. Módulo PURO.
 * Es un ejemplo genérico para que se vea cómo se usan las variables: NO es asesoramiento legal y
 * está marcado como modelo a reemplazar por el texto real.
 */
export const NOMBRE_PLANTILLA_MODELO = "Contrato de eventos (modelo)";

export const CUERPO_PLANTILLA_MODELO = `# Contrato de servicios fotográficos

**MODELO PARA REEMPLAZAR.** Este texto es un ejemplo genérico para mostrar cómo se usan las variables. No es asesoramiento legal: reemplazalo por el texto de tu propio contrato antes de mandarlo a firmar.

Contrato N° [contrato_numero], celebrado el [fecha_hoy] entre las partes que se indican a continuación.

## Las partes

**El prestador:** [empresa_nombre], CUIT [empresa_cuit], con domicilio en [empresa_domicilio].

**Contratante:** [contratante1_nombre], [contratante1_documento], con domicilio en [contratante1_domicilio], correo electrónico [contratante1_correo][si:contratante1_telefono], teléfono [contratante1_telefono][/si].

[si:contratante2_nombre]**Segundo contratante:** [contratante2_nombre], [contratante2_documento], con domicilio en [contratante2_domicilio], correo electrónico [contratante2_correo].[/si]

Quien o quienes contratan se denominan en adelante "el contratante".

## Objeto

El prestador se compromete a realizar el servicio detallado a continuación, correspondiente al pedido N° [pedido_numero], para el evento "[evento]" a realizarse el [evento_fecha]:

[pedido_items]

## Precio y forma de pago

El precio total del servicio es de [pedido_total]. Se abona según el siguiente plan de pagos:

[pedido_cuotas]

La falta de pago en las fechas indicadas autoriza al prestador a suspender la entrega del material hasta regularizar la deuda.

## Cancelación y cambio de fecha

Si el contratante cancela o cambia la fecha del evento, las sumas ya abonadas no se devuelven, salvo que el prestador pueda reasignar la fecha. Indicá acá los plazos y porcentajes que correspondan a tu negocio.

## Derechos de imagen y uso del material

El contratante autoriza al prestador a usar una selección de las fotografías del evento con fines de difusión de su trabajo, salvo que indique lo contrario por escrito. El prestador conserva la autoría de las imágenes; el contratante recibe el derecho de uso personal del material entregado.

## Entrega

Las fechas y formas de entrega del material se coordinarán con el contratante. Indicá acá los plazos de tu negocio.

[salto_de_pagina]

## Firmas

Las partes firman este contrato por medios electrónicos, en conformidad con lo aceptado al momento de la firma.

Por el prestador: [empresa_nombre]

Por el contratante: [contratante1_nombre][si:contratante2_nombre] y [contratante2_nombre][/si]
`;
