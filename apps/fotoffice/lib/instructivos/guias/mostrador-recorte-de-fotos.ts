import type { Instructivo } from "../tipos";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";

export const guia: Instructivo = {
  slug: "mostrador-recorte-de-fotos",
  titulo: "Recortar o encajar las fotos al tamaño de la copia",
  resumen:
    "Cómo queda cada foto sobre el papel (10x15, 13x18, 15x21, canvas o MDF), cuándo recortarla y cuándo encajarla con franjas, cómo moverla, girarla y enderezarla, y qué significan los avisos de calidad.",
  seccion: "Mostrador",
  moduleKey: SALES_MODULE_KEY,
  minutos: 7,
  pasos: [
    {
      titulo: "Dónde está el recorte",
      texto: [
        "El recorte aparece en dos lugares del Cobrador: en «Pedido para laboratorio» (copias que van a Fotolag, cuadros de canvas y MDF) y en «Preparar copias» (las copias que se imprimen en el local).",
        "No hay que hacer nada aparte: cada foto que subís ya llega acomodada al tamaño elegido. Este instructivo explica cómo revisar y cambiar esa propuesta.",
      ],
      nota: "Para cargar el pedido completo (subir fotos, elegir laboratorio, cobrar), seguí la guía «Armar un pedido para el laboratorio desde el Cobrador».",
    },
    {
      titulo: "Lo que el sistema propone solo",
      texto: [
        "Una foto casi nunca tiene la misma forma que el papel: una foto de celular no es igual a un 10x15. Por eso el sistema elige entre dos caminos:",
        "«Recortar»: la foto llena todo el papel y se corta un poco de los bordes. Lo usa cuando se pierde poco (8 % o menos de la foto).",
        "«Encajar»: la foto entra entera y se completan los lados con franjas blancas. Lo usa cuando recortar comería demasiado, por ejemplo una foto cuadrada en un 10x15, para no cortar cabezas ni caras.",
        "El papel también se gira solo: una foto apaisada va en papel acostado y una foto vertical, en papel parado.",
      ],
      sistema: ["La propuesta se arma sola en cada foto al subirla. Si no tocás nada, sale así."],
    },
    {
      titulo: "Revisá las fotos en la grilla",
      texto: [
        "Cada foto se ve sobre su papel, tal como va a salir. Mirá sobre todo los bordes: que no quede cortada una cabeza, una mano o un texto.",
        "Si la propuesta está bien, no hace falta abrirla. Si querés cambiarla, tocá la foto o «Editar».",
      ],
    },
    {
      titulo: "Cambiá entre recortar y encajar",
      texto: [
        "En «Editar», pestaña «Encuadre», tocá «Recortar (R)» o «Encajar (E)». También sirven las teclas R y E.",
        "Con «Recortar», lo que queda oscurecido alrededor es lo que se corta y no sale en la copia.",
        "Con «Encajar», aparece «Color del borde»: las franjas son blancas, pero podés elegir otro color (por ejemplo negro).",
      ],
      nota: "Si el cliente quiere la foto entera, sin cortar nada, usá «Encajar». Si prefiere que no haya franjas, usá «Recortar» y mové la foto para que lo importante quede adentro.",
    },
    {
      titulo: "Mové, acercá, girá y enderezá",
      texto: [
        "Arrastrá la foto con el mouse para elegir qué parte queda en el papel.",
        "«Zoom» (o la rueda del mouse) la acerca o la aleja. Acercar recorta más.",
        "«Enderezar» corrige un horizonte torcido, hasta 10° para cada lado.",
        "«Girar 90°» gira la foto. «Papel parado» / «Papel acostado» cambia la orientación del papel.",
        "«Volver a la propuesta» deshace todo lo que cambiaste en esa foto y la deja como la había armado el sistema.",
        "La casilla «Guías (tercios y zona de seguridad de 3 mm)» muestra líneas de ayuda. No dejes nada importante a menos de 3 mm del borde: el laboratorio puede comerse ese margen al cortar.",
      ],
    },
    {
      titulo: "Retoque de luz y color (opcional)",
      texto: [
        "En la pestaña «Retoque» hay ajustes suaves: «Exposición», «Contraste», «Luces», «Sombras», «Blancos», «Negros», «Temperatura», «Tinte», «Saturación» e «Intensidad».",
        "Es sólo para corregir una foto oscura o con un color raro. Si no hace falta, no lo toques.",
      ],
      sistema: ["La copia se arma desde la foto original, sin perder calidad: lo que se ve en pantalla es una vista previa."],
    },
    {
      titulo: "Leé el aviso de calidad",
      texto: [
        "Si la foto es chica para el tamaño elegido, aparece un aviso debajo de la foto:",
        "«Puede verse algo blanda en …» (en amarillo): la copia sale, pero puede verse un poco suave. Para una copia chica suele estar bien; para un cuadro, conviene avisarle al cliente.",
        "«Se va a ver pixelada en …» (en rojo) y la marca «Pixelada» en la grilla: se van a notar los puntitos. Pedile al cliente la foto original (no la de WhatsApp) o proponele un tamaño más chico.",
        "El número de «ppp efectivos» indica cuánta definición queda: 200 o más está bien.",
      ],
      nota: "Acercar con el zoom baja la definición: una foto que estaba bien puede pasar a «algo blanda» si la acercás mucho.",
    },
    {
      titulo: "Cuadros de canvas y MDF: el doblez",
      texto: [
        "En los cuadros, lo que ves en pantalla es el frente. Además llevan 5 cm de cada lado que doblan sobre el bastidor o la placa.",
        "En «Doblez de 5 cm por lado» elegí cómo se rellenan: «Espejo» (viene elegido y no pierde nada del frente), «Desenfocado», «Color liso» o «Foto envolvente».",
        "«Foto envolvente» se come 5 cm de cada borde del frente: no la uses si hay caras o texto cerca del borde.",
      ],
      sistema: ["El archivo que recibe el laboratorio ya sale con el doblez armado."],
    },
    {
      titulo: "Pasá a la foto siguiente y terminá",
      texto: [
        "Tocá «Revisada, siguiente (Enter)» para guardar y pasar a la próxima foto. En la última, el botón dice «Revisada (Enter)». Las flechas ← → también pasan de foto.",
        "«Usar este modo y cantidad en todas» copia «Recortar» o «Encajar», la cantidad de copias y el doblez a todas las fotos del pedido.",
        "«Volver a la grilla» sale del editor. Las fotos que ya miraste quedan marcadas «Revisada».",
      ],
      sistema: ["Cada foto se guarda al pasar a la siguiente. Si cerrás la pantalla, lo hecho no se pierde."],
    },
  ],
};
