import type { Instructivo } from "../tipos";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";

export const guia: Instructivo = {
  slug: "socios-buscar-y-ficha",
  titulo: "Buscar un socio y ver su ficha",
  resumen: "Cómo encontrar a un socio en el Padrón, filtrar la lista, abrir su ficha y corregir sus datos.",
  seccion: "Socios",
  moduleKey: MEMBERS_MODULE_KEY,
  minutos: 6,
  pasos: [
    {
      titulo: "Abrí el Padrón",
      texto: [
        "En el menú de la izquierda, desplegá “Socios” y tocá “Padrón”.",
        "Arriba ves cuántos socios hay en total y cuántos están Activos, Suspendidos e Inactivos. Debajo está la lista completa.",
      ],
    },
    {
      titulo: "Buscá por nombre, número o documento",
      texto: [
        "Usá la caja de búsqueda que está arriba de la lista. Sirve el nombre, el apellido, el número de socio, el correo o el documento.",
        "La lista se achica a medida que escribís.",
      ],
    },
    {
      titulo: "Filtrá la lista",
      texto: [
        "Debajo de la búsqueda están los filtros: Estado, Categoría, Etiqueta, Acceso al portal y, si tenés permiso para ver cuotas, Deuda (“Con deuda” o “Al día”).",
        "Cada filtro que aplicás aparece como una etiqueta arriba de la lista. Tocá la cruz de una etiqueta para quitar ese filtro, o “Limpiar todo” para volver a ver a todos.",
      ],
      nota: "En el teléfono los filtros están plegados: tocá “Filtros” para verlos.",
    },
    {
      titulo: "Mirá un resumen sin salir de la lista",
      texto: [
        "En la computadora, tocá cualquier parte de la fila de un socio (no sobre el nombre) y se abre a la derecha una vista rápida: número, estado, categoría, deuda, último carnet y acceso al portal.",
        "Con las flechitas de arriba pasás al socio anterior o al siguiente. Con la cruz la cerrás.",
      ],
    },
    {
      titulo: "Abrí la ficha completa",
      texto: [
        "Tocá el nombre del socio en la lista, o “Abrir ficha” en la vista rápida.",
        "Arriba ves el nombre, el número, el estado y la categoría, y botones para llamarlo, escribirle por WhatsApp o mandarle un correo.",
      ],
    },
    {
      titulo: "Recorré lo que muestra la ficha",
      texto: [
        "A la derecha están los datos: Identidad, Contacto, Información societaria (número, categoría, fecha de ingreso, estado), Acceso a FotoOffice, Pagos y Recomendaciones.",
        "En el centro está la historia: podés dejar una nota con “Guardar nota” y debajo ves todo lo que pasó con ese socio, lo más reciente primero.",
      ],
      nota: "Lo que ves depende de tu rol: los pagos sólo aparecen si tenés permiso en Cuotas, y la historia sólo si podés gestionar socios.",
    },
    {
      titulo: "Corregí sus datos",
      texto: [
        "En la ficha, tocá “Editar” (arriba a la derecha). Cambiá lo que haga falta y tocá “Guardar cambios”.",
        "Con “Volver a la ficha” salís sin guardar.",
      ],
      nota: "Si no ves el botón “Editar”, tu rol sólo permite ver socios, no gestionarlos.",
    },
    {
      titulo: "Cambiá el estado (suspender o dar de baja)",
      texto: [
        "En la tarjeta Información societaria, en “Estado”, elegí Activo, Suspendido o Inactivo y tocá “Cambiar”.",
        "Para Suspendido o Inactivo te pide un Motivo obligatorio. Queda registrado en su historia con tu nombre y la fecha.",
      ],
    },
  ],
};
