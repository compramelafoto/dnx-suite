import type { Instructivo } from "../tipos";

export const guia: Instructivo = {
  slug: "primeros-pasos",
  titulo: "Primeros pasos en el panel",
  resumen: "Cómo entrar a FOTOFFICE, elegir la institución y moverte por el menú del panel.",
  seccion: "Primeros pasos",
  minutos: 5,
  pasos: [
    {
      titulo: "Entrá a fotoffice.com",
      texto: [
        "Abrí fotoffice.com/login en el navegador. Vas a ver la pantalla “Iniciar sesión”.",
        "Escribí tu Email y tu Contraseña y tocá “Iniciar sesión”. Si tu cuenta es de Google, podés tocar “Continuar con Google” en lugar de escribir la contraseña.",
        "Si no te acordás la contraseña, tocá “¿Olvidaste tu contraseña?” y te llega un enlace por correo para crear una nueva.",
      ],
    },
    {
      titulo: "Elegí la institución",
      texto: [
        "Si tu cuenta está en más de una institución (por ejemplo, la SFPR y tu propio estudio), aparece la pantalla “¿A dónde querés entrar?”.",
        "Tocá la tarjeta de la institución y después “Entrar →”. Si estás en una sola, este paso no aparece: entrás directo.",
      ],
    },
    {
      titulo: "Pasá de Socio a Comisión Directiva",
      texto: [
        "Arriba del menú de la izquierda está el selector “Rol”, con dos botones: “Socio” y “Comisión Directiva”.",
        "“Comisión Directiva” abre el panel de gestión de la institución. “Socio” te lleva a tu portal personal, el mismo que ve cualquier socio.",
        "El botón resaltado es donde estás ahora. Tocá el otro para cambiar.",
      ],
      nota: "El selector sólo aparece si sos socio y además integrás la comisión. Si no lo ves, no hace falta: entrás directo al panel.",
    },
    {
      titulo: "Conocé el menú lateral",
      texto: [
        "Arriba de todo está “Inicio”, el tablero de la institución con lo pendiente y lo último que pasó.",
        "Debajo, el menú se agrupa por secciones: Socios, Sorteos, Comisión, Comunicación, Reservas, Institución y otras. Tocá el título de una sección para desplegarla o plegarla. Plegada, muestra cuántas opciones tiene.",
        "Cada persona ve sólo las secciones que su rol le permite. Si te falta algo que necesitás, pedíselo a quien administra la comisión.",
      ],
    },
    {
      titulo: "Usá el buscador del menú",
      texto: [
        "Arriba del menú está el botón “Buscar”. Tocalo y escribí lo que buscás: por ejemplo “cuotas”, “carnet” o “solicitudes”.",
        "Con las flechas del teclado elegís un resultado y con Enter vas a esa pantalla. Con Esc lo cerrás.",
        "Atajo: desde cualquier pantalla, apretá ⌘K en Mac o Ctrl K en Windows.",
      ],
    },
    {
      titulo: "Encontrá los instructivos",
      texto: [
        "Al pie del menú lateral está “Instructivos”: ahí están todas estas guías, ordenadas por tema.",
        "Podés volver cuando quieras; no hace falta aprenderse todo de una vez.",
      ],
    },
    {
      titulo: "Salí cuando termines",
      texto: [
        "Arriba a la derecha, al lado de tu nombre, está el botón “Salir”. Usalo sobre todo si entraste desde una computadora compartida.",
      ],
    },
  ],
};
