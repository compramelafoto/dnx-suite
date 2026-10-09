import type { Instructivo } from "../tipos";
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";

export const guia: Instructivo = {
  slug: "sorteos-conducir",
  titulo: "Sorteos: de crearlo a entregar el premio",
  resumen:
    "Armar un sorteo entre los socios al día, anunciarlo, sortearlo de forma verificable y seguir la entrega de los premios.",
  seccion: "Actividades",
  moduleKey: RAFFLES_MODULE_KEY,
  minutos: 8,
  pasos: [
    {
      titulo: "Creá el sorteo",
      texto: [
        "En el menú, entrá a Sorteos y tocá Nuevo sorteo. Escribí el Título y, si querés, una Descripción: es lo que lee el socio en su portal.",
        "En El acto poné el día y la hora del sorteo. Cierre del padrón lo podés dejar vacío: cierra solo 24 horas antes del acto. Tocá Crear sorteo.",
      ],
      nota:
        "Si la institución tiene activado el sorteo mensual, el borrador de cada mes aparece solo en la lista, con los premios que las marcas ya comprometieron. En ese caso, empezá directamente por revisar los premios.",
    },
    {
      titulo: "Cargá los premios",
      texto: [
        "El sorteo queda en Borrador. Abajo, en Agregar un premio, completá el Premio y el Orden (el 1 se sortea primero).",
        "En Marca que lo dona empezá a escribir y elegí la marca de la lista; si no está, escribí el nombre igual. Completá Dónde lo retira el ganador: correo del aliado, dirección, horarios y teléfono. Tocá Agregar premio y repetí por cada premio.",
      ],
      nota:
        "El correo del aliado es importante: ahí le avisamos a quién entregarle el premio y le pedimos el remito.",
    },
    {
      titulo: "Anunciá el sorteo",
      texto: [
        "Cuando estén todos los premios, en Qué se puede hacer ahora tocá Anunciar el sorteo. Desde ese momento los socios lo ven y aparece el botón Página pública (para proyectar).",
      ],
      nota:
        "Después de anunciar ya no se pueden cambiar ni las fechas ni los premios. Revisalos bien antes.",
    },
    {
      titulo: "Sellá el padrón cuando cierre",
      texto: [
        "Al llegar el cierre del padrón, el sistema congela la lista de socios al día y publica su «huella»: un código que prueba que nadie cambió la lista después. Normalmente lo hace solo.",
        "Si en la lista de Sorteos ves el aviso «Hay un sorteo con el padrón vencido y sin sellar», entrá al sorteo y tocá Sellar el padrón.",
      ],
    },
    {
      titulo: "Sorteá el día del acto",
      texto: [
        "Llegada la hora del acto, abrí el sorteo y tocá Sortear ahora. El ganador sale de un número que publica un servicio público (drand) y de la lista ya sellada: nadie puede elegirlo.",
        "Si el número todavía no salió, el sistema avisa y vuelve a intentar solo. Para el acto en vivo, proyectá la Página pública.",
      ],
    },
    {
      titulo: "Mostrá la prueba si alguien pregunta",
      texto: [
        "En el sorteo aparece la sección La prueba, con la huella del padrón y el número usado. Con el enlace «Ver la pantalla de verificación, tal como la ve el socio» podés mostrar lo mismo que ve cualquier socio para comprobar que no se arregló.",
      ],
    },
    {
      titulo: "Seguí la entrega de premios",
      texto: [
        "En el menú, entrá a Sorteos → Entregas. Ahí están los premios ganados que falta avisar o entregar, con lo que vence primero arriba.",
        "Cuando hablaste con el ganador, tocá Ya le avisamos. Cuando lo retiró, escribí una nota si querés y tocá Lo retiró. Si venció el plazo, aparece No lo retiró.",
      ],
      nota:
        "Arriba aparecen los Premios entregados sin comprobante: cuando el aliado mande el remito, pegá el enlace y tocá Registrar el comprobante.",
    },
    {
      titulo: "Si hay que suspenderlo",
      texto: [
        "Antes de sellar el padrón, podés escribir el motivo y tocar Cancelar el sorteo. El motivo queda guardado en la Historia.",
        "Con el padrón ya sellado, el sorteo no se puede cancelar desde el panel.",
      ],
    },
  ],
};
