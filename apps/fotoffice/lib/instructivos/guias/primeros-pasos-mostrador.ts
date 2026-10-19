import type { Instructivo } from "../tipos";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";

export const guia: Instructivo = {
  slug: "primeros-pasos-mostrador",
  titulo: "Primeros pasos en el mostrador del estudio",
  resumen:
    "Entrar a FOTOFFICE, encontrar el Cobrador, moverte por el menú y saber qué mirar al empezar y al terminar el día.",
  seccion: "Primeros pasos",
  moduleKey: SALES_MODULE_KEY,
  minutos: 5,
  pasos: [
    {
      titulo: "Entrá a FOTOFFICE",
      texto: [
        "Abrí fotoffice.com/login. Escribí tu correo y tu contraseña y tocá «Iniciar sesión», o tocá «Continuar con Google» si tu cuenta es de Google.",
        "Si te olvidaste la contraseña, tocá «¿Olvidaste tu contraseña?»: te llega un enlace por correo para crear una nueva.",
      ],
    },
    {
      titulo: "El inicio",
      texto: [
        "Al entrar ves el inicio del estudio. El botón grande «Cobrador» abre directo la pantalla para cobrar.",
        "Más abajo están «Mis tareas» (lo que tenés que hacer, con lo vencido primero) y «Mis entregas de la semana» (los trabajos tuyos que vencen en los próximos 7 días).",
      ],
      imagen: "/instructivos/primeros-pasos-mostrador/01-inicio.jpg",
      imagenAlt:
        "Inicio del estudio con el botón Cobrador, Cargar en caja, el recuadro Para atender y el total en caja; a la izquierda el menú con la sección Caja abierta.",
    },
    {
      titulo: "El menú de la izquierda",
      texto: [
        "Las secciones que más vas a usar: «Caja» (Cobrador, Panorama, Movimientos, Arqueos), «Ventas» (Mostrador, Catálogo, Stock, Ventas hechas), «Proyectos» (los trabajos y su tablero «En curso»), «Clientes» y «Agenda».",
        "Sólo ves lo que tu usuario puede usar. Si te falta algo que necesitás, pedíselo a quien administra FOTOFFICE.",
      ],
      nota: "Con el usuario de equipo no se entra a la configuración (precios, cuentas de Caja, etapas de los trabajos, plantillas de correo). Eso lo maneja el dueño o un administrador.",
    },
    {
      titulo: "Buscá cualquier pantalla",
      texto: [
        "Tocá «Buscar» arriba del menú, o apretá Ctrl+K (⌘+K en Mac). Escribí lo que buscás («arqueo», «vender», «stock») y apretá Enter.",
        "Este buscador encuentra pantallas, no personas. Para buscar un cliente usá el buscador de Clientes o del Cobrador.",
      ],
      imagen: "/instructivos/primeros-pasos-mostrador/02-buscador.jpg",
      imagenAlt:
        "El buscador del menú abierto con la palabra «arqueo» escrita y el resultado Arqueos marcado.",
    },
    {
      titulo: "Tu rutina del día",
      texto: [
        "Al abrir: abrí la caja (guía «Abrir la caja al empezar el día») y mirá en Proyectos → «En curso» qué hay vencido y qué está listo para retirar.",
        "Durante el día: cobrá en el Cobrador, tomá los trabajos con seña y marcá en el tablero lo que va y vuelve del laboratorio.",
        "Al cerrar: anotá los gastos del día y cerrá la caja con el arqueo (guía «Cerrar la caja y hacer el arqueo»).",
      ],
    },
    {
      titulo: "Volvé a estos instructivos",
      texto: [
        "Están al pie del menú, en «Instructivos». Cada guía se puede imprimir o guardar en PDF con el botón de arriba.",
      ],
    },
  ],
};
