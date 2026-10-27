import type { Instructivo } from "../tipos";
import { DIGITALIZACION_MODULE_KEY } from "@/lib/digitalizacion/constants";

export const guia: Instructivo = {
  slug: "digitalizacion-configuracion-y-problemas",
  titulo: "Digitalización: configuración, casos especiales y preguntas",
  resumen:
    "Qué se ajusta en la configuración de Digitalización y qué hacer cuando algo no sale: el botón Grabar gris, la capturadora que se corta, un video que no se ve o un correo que no llega.",
  seccion: "Digitalización",
  moduleKey: DIGITALIZACION_MODULE_KEY,
  minutos: 8,
  pasos: [
    {
      titulo: "La configuración de Digitalización",
      texto: [
        "En el menú entrá a Digitalización y abrí «Configuración» (está arriba, debajo del título). Sólo la ve quien puede grabar.",
        "• «Cortar tras … minutos sin imagen»: cuánto espera con la pantalla azul o negra antes de cortar sola la grabación. Viene en 5; se puede poner de 1 a 30. Tocá «Guardar».",
        "• «Enviar al cliente automáticamente al terminar»: si está tildado, los pedidos nuevos mandan los videos solos cuando están todos los cassettes. En cada pedido se puede cambiar con «Enviar automáticamente».",
        "• «Envío de cassettes a domicilio»: las franjas de precio según la distancia desde el estudio. Cada franja es «Hasta … km cuesta … pesos». Tocá «Agregar franja» para sumar una, «Quitar» para borrarla y «Guardar» al final.",
      ],
      nota: "Si el cliente vive más lejos que la última franja, o no hay franjas cargadas, el envío queda «A coordinar» y hay que escribirle. Una franja de 0 pesos es envío sin cargo.",
    },
    {
      titulo: "«El botón Grabar no se habilita»",
      texto: [
        "Mirá la lista «Para poder grabar falta:» que está debajo del botón: dice exactamente qué falta (la capturadora, el audio, la vista previa, el recuadro de chequeo o el pedido).",
        "Si aparece «No pudimos abrir la capturadora. ¿Está abierta en Meet, Zoom u otro programa?», cerrá ese programa y volvé a elegir la capturadora en «Video».",
        "Si aparece «Este navegador no puede grabar video» o «El navegador no puede grabar con esta capturadora», usá Google Chrome actualizado. Si sigue, probá desenchufar la capturadora, volver a enchufarla y recargar la página.",
      ],
    },
    {
      titulo: "«La capturadora dejó de enviar imagen»",
      texto: [
        "Aparece si la capturadora se desenchufó, se movió el cable USB o la tomó otro programa. La grabación se frena y lo grabado hasta ahí se sube igual.",
        "Volvé a enchufarla y esperá a ver la vista previa.",
        "Lo grabado queda como una grabación terminada, pero le falta un pedazo. Lo más prolijo: rebobiná el cassette, tocá «Descartar» en esa grabación y volvé a grabarlo desde el principio con el mismo número.",
      ],
      nota: "No grabes el resto como otra grabación del mismo cassette: el sistema contaría dos cassettes donde hay uno.",
    },
    {
      titulo: "«Failed to fetch» al subir",
      texto: [
        "Quiere decir que se cortó la conexión con internet en el momento de subir un pedacito. En la ventanita se ve como «Reintentando: Failed to fetch».",
        "No hace falta hacer nada: la grabación sigue, lo grabado se guarda en la computadora y se sube solo cuando vuelve internet.",
        "Lo único importante: no cierres la pestaña ni apagues la computadora hasta que diga «Subida al día ✓». Si se cierra igual, al volver a abrir «Grabar» en la misma computadora sigue subiendo lo que quedó.",
      ],
    },
    {
      titulo: "Un cassette quedó a medias",
      texto: [
        "Si se cerró la pestaña, se colgó la computadora o se cortó la luz mientras grababa, la grabación aparece «Interrumpida» (en el trabajo, «Quedó a medias»).",
        "Si la cinta no terminó: tocá «Continuar», revisá la vista previa, tocá «● Grabar» y dale Play a la casetera desde donde quedó. Se graba como una segunda parte de la misma grabación y se convierte todo junto.",
        "Si la cinta ya había terminado: tocá «Terminar con lo grabado».",
      ],
    },
    {
      titulo: "Se grabó en el pedido equivocado",
      texto: [
        "Una grabación no se puede pasar de un trabajo a otro.",
        "Tocá «Descartar» en esa grabación (así deja de contar en el pedido equivocado) y grabá de nuevo el cassette desde el trabajo correcto, con «● Grabar cassette».",
        "Si los videos del pedido equivocado ya se le habían mandado a ese cliente, avisale a quien administra FOTOFFICE antes de descartar.",
      ],
    },
    {
      titulo: "«No se pudo reproducir el video»",
      texto: [
        "Recargá la página y probá de nuevo. Si tarda mucho en pausa, el enlace del video vence por seguridad y hay que recargar.",
        "«La versión para mirar todavía se está preparando»: el video recién se terminó de convertir. Probá en un rato.",
        "Si dice «No se pudo preparar la vista previa (falló 3 veces)», no se puede mirar en el navegador, pero el video se puede descargar igual con «Descargar video».",
      ],
    },
    {
      titulo: "«El cliente dice que no le llegó el correo»",
      texto: [
        "1. En la entrega del pedido fijate a qué dirección salió («Enviado el … por correo a …») y confirmala con el cliente. Si aparece «Ojo: la casilla … rebotó», la dirección está mal o no recibe correos.",
        "2. Pedile que busque en Spam o en Promociones.",
        "3. Si la dirección estaba mal, corregila en la ficha del cliente y tocá «Reenviar».",
        "4. Si sigue sin llegar, tocá «Copiar enlace» y mandáselo por WhatsApp.",
      ],
      nota: "«Reenviar» y «Copiar enlace» generan un enlace nuevo: el anterior deja de funcionar. Decile al cliente que use el último.",
    },
    {
      titulo: "«El cliente no puede ver el video»",
      texto: [
        "Lo más común es el saldo: si debe algo, los videos quedan bloqueados. En la entrega dice «Le falta pagar … pesos: los videos están bloqueados hasta que pague.». Apenas paga, se habilitan solos.",
        "Si usa un enlace viejo (de antes de un «Reenviar» o un «Copiar enlace»), no le va a abrir: mandale el último.",
        "Si ya usó las 3 descargas, su página dice «Ya usaste las 3 descargas de este video.»: puede tocar «Comprar otra descarga».",
        "Si pasaron los 30 días, los videos ya se borraron y no se pueden recuperar.",
        "Para ver exactamente lo que ve él, tocá «Ver como el cliente».",
      ],
    },
    {
      titulo: "Grabaciones sin sonido",
      texto: [
        "Si la capturadora no mandó sonido (por un cable flojo, o porque la cinta no tiene audio), la grabación igual se convierte: el video queda en silencio.",
        "Para evitarlo, antes de grabar tocá «Monitorear audio» y fijate que se escuche y se mueva el medidor. Si el botón dice «La capturadora no envía audio», revisá los cables de audio de la casetera.",
        "Si ya se grabó sin sonido y la cinta sí tenía, descartala y grabala de nuevo.",
      ],
    },
  ],
};
