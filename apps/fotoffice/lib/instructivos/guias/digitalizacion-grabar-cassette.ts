import type { Instructivo } from "../tipos";
import { DIGITALIZACION_MODULE_KEY } from "@/lib/digitalizacion/constants";

export const guia: Instructivo = {
  slug: "digitalizacion-grabar-cassette",
  titulo: "Digitalización: vender y grabar un cassette",
  resumen:
    "Cómo es el circuito completo de un VHS o DVD, cómo se vende, cómo se prepara el equipo y cómo se graba cada cassette sin perder nada, hasta dejar la computadora apagándose sola.",
  seccion: "Digitalización",
  moduleKey: DIGITALIZACION_MODULE_KEY,
  minutos: 12,
  pasos: [
    {
      titulo: "El circuito completo, de punta a punta",
      texto: [
        "Así viaja un pedido de digitalización. Las chicas del mostrador hacen los pasos 1, 3 y, si hace falta, el 6 y el 9; el resto lo hace FOTOFFICE solo.",
        "1. Venta en el Cobrador (con seña) → 2. se crea el trabajo → 3. se graba cada cassette → 4. el servidor convierte cada grabación a video → 5. se prepara la versión para mirar → 6. se le manda el enlace al cliente → 7. el cliente mira y descarga → 8. a los 30 días los videos se borran → 9. el cliente retira sus cassettes.",
        "La conversión (paso 4) deja el video en Full HD (la calidad de un televisor moderno), con la marca de DNX y con el volumen del audio emparejado, para que no haya partes que se escuchan bajito y otras que aturden.",
        "La «versión para mirar» (paso 5) es una copia liviana que se puede ver en el navegador y saltar a cualquier minuto al instante, sin esperar a que se baje entera.",
      ],
    },
    {
      titulo: "Vendé: la cantidad es la cantidad de cassettes",
      texto: [
        "En el Cobrador agregá el producto de digitalización (por ejemplo, «Digitalización de VHS») y poné en la cantidad cuántos cassettes deja el cliente. Si deja 20 cassettes, la cantidad es 20.",
        "Esto importa mucho: el sistema espera los 20. No avanza el trabajo ni le manda los videos al cliente hasta que estén los 20 hechos (grabados, o registrados como que no se pudieron digitalizar).",
        "Elegí el cliente y pedile el correo y el WhatsApp: por ahí le llega el enlace a sus videos.",
        "Cobrá la seña como en cualquier trabajo para retirar (ver la guía «Tomar un trabajo para retirar (con seña)»). El resto queda como saldo del pedido.",
      ],
      sistema: [
        "Crea el pedido y un trabajo de digitalización, con la cantidad de cassettes vendidos.",
        "Registra la seña con su recibo y la anota en Caja.",
      ],
      nota: "Mientras el cliente no pague el saldo, los videos quedan bloqueados: los puede ver en la lista, pero no reproducirlos ni descargarlos. En su página le aparece «Pagar el saldo».",
    },
    {
      titulo: "Entrá a grabar",
      texto: [
        "Hay cuatro caminos y todos llevan a la misma pantalla «Grabar»:",
        "• En el Cobrador, al terminar la venta, tocá «● Ir a grabar» (aparece debajo de «Pedido N creado»).",
        "• En la ficha del trabajo, en la tarjeta «Digitalización», tocá «● Grabar cassette».",
        "• En la ficha del pedido, en la tarjeta «Digitalización», tocá «● Grabar» al lado del trabajo.",
        "• En el menú, entrá a Digitalización y tocá «● Grabar» (arriba a la derecha).",
        "Desde el trabajo, el pedido o el Cobrador, el trabajo ya viene elegido: arriba dice «Trabajo … (pedido …). Si no es éste, elegí otro de la lista.» y el número de cassette ya viene puesto con el siguiente que falta.",
        "Para retomar una grabación que se cortó, en Digitalización buscala (dice «Interrumpida» o, en la ficha del trabajo, «Quedó a medias») y tocá «Continuar».",
      ],
    },
    {
      titulo: "Prepará el equipo",
      texto: [
        "Usá Google Chrome (o Edge) actualizado, en la computadora del local. Con otro navegador aparece «La estación necesita Chrome o Edge de escritorio actualizados».",
        "Enchufá la capturadora USB (el aparatito que pasa la imagen de la casetera a la computadora) y conectale la casetera.",
        "La primera vez aparece «Antes de la primera grabación, chequeá:»: que la computadora no se suspenda nunca (la pantalla sí puede apagarse) y que la capturadora no esté abierta en Meet, Zoom u otro programa. Revisalo y tocá «Listo, ya lo chequeé».",
        "En «1. Equipo» tocá «Buscar la capturadora». Chrome pregunta si puede usar la cámara y el micrófono: tocá «Permitir».",
        "En «Video» elegí la capturadora, y en «Audio» elegí también la capturadora (no el micrófono de la computadora). FOTOFFICE se acuerda de lo elegido para la próxima.",
        "En «2. Vista previa» tiene que aparecer la imagen de la casetera y moverse la barrita verde del sonido.",
      ],
      nota: "Si la gente se ve ancha, tildá «La imagen se ve estirada (la gente se ve ancha)». La «Calidad» dejala en «Media», salvo que te pidan otra.",
    },
    {
      titulo: "Leé la lista «Para poder grabar falta:»",
      texto: [
        "Mientras falte algo, el botón «● Grabar» queda gris y debajo aparece la lista de lo que falta. Cada renglón quiere decir:",
        "• «Elegí la capturadora en «Video».»: falta elegirla en el primer desplegable.",
        "• «Elegí la entrada de audio en «Audio» (sin audio no se puede grabar).»: falta el segundo desplegable.",
        "• «Esperá a que aparezca la vista previa de la capturadora.»: la capturadora todavía no manda imagen. Si no aparece nunca, revisá que esté enchufada y que no la tenga otro programa.",
        "• «Tocá «Listo, ya lo chequeé» en el recuadro de arriba.»: falta confirmar el recuadro del principio.",
        "• «Elegí el pedido de la lista o tildá «Sin pedido (prueba)».»: falta decir de qué trabajo es.",
        "• «Esperá a que termine de subir el DVD.»: hay un DVD subiendo en esta misma pantalla.",
      ],
    },
    {
      titulo: "Elegí el trabajo, el título y el número de cassette",
      texto: [
        "En «3. ¿De qué pedido es?» buscá por número de trabajo o por cliente y tocá el trabajo. Si llegaste desde el trabajo o el Cobrador, ya está elegido.",
        "«Título del video (opcional)»: lo que ve el cliente, por ejemplo «Casamiento de Juan y Ana, 1998». Si no ponés nada, se llama «Cassette 3». Se puede cambiar después.",
        "«Cassette n.º»: el número del cassette que estás por poner. Numeralos (con una etiqueta) para no repetir ni saltear ninguno.",
        "«Sin pedido (prueba)» es sólo para probar el equipo: esa grabación no va a ningún cliente.",
      ],
    },
    {
      titulo: "Grabá",
      texto: [
        "Poné el cassette en la casetera, rebobinado. Tocá «● Grabar» y enseguida dale Play a la casetera.",
        "Al tocar Grabar, FOTOFFICE primero prueba con tu capturadora el formato de grabación (dice «Probando con tu capturadora el formato de grabación…»). Tarda unos segundos; después arranca solo.",
        "Se abre una ventanita flotante que queda arriba de todo: muestra la imagen, el tiempo grabado, «Subida al día ✓» o lo que queda por subir, y el botón «⏹ Detener». Mientras tanto podés usar la computadora para otra cosa.",
        "Si cerraste la ventanita sin querer, la grabación sigue: en la pantalla «Grabar» tocá «Abrir ventanita».",
      ],
      sistema: [
        "Graba de a pedacitos de 10 segundos y los va subiendo a la nube mientras graba.",
        "Mira la imagen todo el tiempo para darse cuenta cuando se termina la cinta.",
      ],
    },
    {
      titulo: "Escuchá el audio («Monitorear audio»)",
      texto: [
        "Para escuchar lo que se está grabando, tocá «Monitorear audio» (está en la pantalla y en la ventanita). Aparecen el «Volumen», un medidor de nivel (la barrita verde) y, si no llega sonido por más de 3 segundos, el aviso «Sin audio».",
        "Para apagarlo, «Dejar de monitorear».",
        "Se escucha con un pequeño retraso. Si hay un micrófono cerca, usá auriculares para que no se acople (el chillido que se arma cuando el parlante vuelve a entrar por el micrófono).",
        "El volumen del monitoreo no cambia lo que se graba: sólo cambia lo que escuchás vos.",
      ],
      nota: "Si el botón dice «La capturadora no envía audio», la capturadora no está mandando sonido: revisá los cables de audio y que en «Audio» esté elegida la capturadora.",
    },
    {
      titulo: "El corte automático cuando se termina la cinta",
      texto: [
        "No hace falta quedarse mirando: cuando la cinta termina y la imagen queda en pantalla azul o negra, FOTOFFICE espera 5 minutos sin imagen y corta solo.",
        "En la ventanita se ve «Sin imagen hace … — se corta en …». Si vuelve la imagen, la cuenta se reinicia.",
        "Los 5 minutos se cambian en Digitalización → «Configuración» → «Cortar tras … minutos sin imagen» (de 1 a 30).",
        "Para que reconozca mejor la pantalla «sin señal» de tu casetera, con la casetera apagada tocá «Calibrar “sin señal”». Queda «✓ Calibrado» para ese equipo.",
      ],
      sistema: ["Al cortar, sube lo último que faltaba y cierra la grabación con el aviso «Se cortó sola: 5 minutos sin imagen.»."],
    },
    {
      titulo: "Detener a mano y esperar a que suba",
      texto: [
        "Si querés terminar antes, tocá «⏹ Detener» en la pantalla o en la ventanita.",
        "Después aparece «Terminando de subir… no cierres esta página.». Esperá a ver «Grabación terminada y subida.» y el botón «Ver grabaciones».",
        "No cierres la pestaña ni apagues la computadora hasta que termine de subir. Mientras graba, tampoco salgas de la pantalla «Grabar»: se puede minimizar la ventana, pero no cambiar de página.",
        "Si se corta internet, no pasa nada: lo grabado se guarda en la computadora (la «cola de subida», una fila de pedacitos esperando su turno) y se sube solo cuando vuelve la conexión. En la ventanita se ve «Pendiente: … MB» y «Reintentando: …».",
        "Si se cerró la pestaña o se apagó la computadora en medio, volvé a abrir la pantalla «Grabar» en esa misma computadora: dice «Subiendo N pedacitos que quedaron de una grabación anterior…». Después, en Digitalización, la grabación aparece «Interrumpida»: tocá «Continuar» y seguí grabando desde donde quedó la cinta, o «Terminar con lo grabado» si ya estaba completa.",
      ],
      nota: "La grabación tiene un tope de seguridad de 8 h 30 min: alcanza para las cintas más largas.",
    },
    {
      titulo: "Un DVD se sube, no se graba",
      texto: [
        "En la misma pantalla «Grabar», más abajo, está «Digitalizar DVD».",
        "Poné el DVD en la computadora, elegí el trabajo (y si querés, el título) y tocá «Elegir la carpeta del DVD». Elegí el disco o su carpeta VIDEO_TS.",
        "Se sube solo (dice «Subiendo parte … de …») y podés seguir usando la computadora. Al final dice «DVD subido completo.».",
        "Si se cortó a mitad, en Digitalización tocá «Continuar» y elegí de nuevo la carpeta del mismo DVD: se sube sólo lo que faltó.",
      ],
    },
    {
      titulo: "Apagar la computadora al terminar (Windows)",
      texto: [
        "Para dejar una cinta grabando y irse, se puede pedir que la computadora se apague sola cuando todo quedó subido. Hace falta un «ayudante»: un programita que se instala una sola vez en la computadora del local y que sólo atiende a FOTOFFICE.",
        "Para instalarlo, debajo de «● Grabar» abrí «Apagar la computadora al terminar (Windows)» (o tocá «Ver cómo instalarlo») y seguí los pasos:",
        "1. Tocá «Descargar el ayudante».",
        "2. En la carpeta Descargas, clic derecho sobre ayudante-apagado.ps1 → «Ejecutar con PowerShell». Si Windows no lo deja, abrí PowerShell, tocá «Copiar» al lado del comando que muestra FOTOFFICE, pegalo y apretá Enter.",
        "3. Al terminar, el ayudante muestra un código de 6 números. Escribilo en FOTOFFICE y tocá «Guardar código».",
        "4. Si Chrome pregunta si FOTOFFICE puede acceder a otros dispositivos o apps de esta computadora (el permiso de «red local»), tocá «Permitir».",
        "Cuando dice «✓ Ayudante conectado.», ya se puede tildar «Apagar la computadora al terminar», antes de grabar o mientras graba.",
      ],
      sistema: [
        "Cuando termina de grabar y de subir todo, muestra un aviso grande: «La computadora se va a apagar en 60 s», con el botón «Cancelar».",
        "Si nadie cancela, Windows se apaga 30 segundos después.",
        "Si algo no se pudo subir, no apaga y dice por qué («No apagamos la computadora: …»).",
      ],
      nota: "Si perdiste el código, volvé a ejecutar el ayudante: muestra el mismo. Si dice que se bloqueó por códigos equivocados, esperá 5 minutos y tocá «Probar de nuevo».",
    },
  ],
};
