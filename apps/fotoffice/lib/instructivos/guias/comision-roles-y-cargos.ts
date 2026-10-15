import type { Instructivo } from "../tipos";

export const guia: Instructivo = {
  slug: "comision-roles-y-cargos",
  titulo: "Integrantes, roles y cargos de la comisión",
  resumen: "Cómo sumar a alguien a la comisión, darle permisos con un rol y ordenar los cargos.",
  seccion: "Comisión",
  soloAdministracion: true,
  minutos: 8,
  pasos: [
    {
      titulo: "Abrí la Comisión directiva",
      texto: [
        "En el menú de la izquierda, desplegá “Institución” y tocá “Comisión directiva”.",
        "Arriba hay tres pestañas: “Integrantes” (quién está), “Cargos” (Presidente, Secretario, Tesorero…) y “Roles” (qué puede hacer cada uno en el panel).",
      ],
      nota: "Esta pantalla sólo la ven el dueño y los administradores de la institución. Si no aparece en tu menú, no tenés ese permiso.",
    },
    {
      titulo: "Entendé la diferencia entre cargo y rol",
      texto: [
        "El cargo dice quién es quién en la comisión (por ejemplo, Tesorero) y si vota.",
        "El rol dice qué puede ver y hacer esa persona en el panel. Una persona puede tener un cargo y varios roles, o sólo roles sin cargo (por ejemplo, personal administrativo).",
      ],
    },
    {
      titulo: "Sumá un integrante",
      texto: [
        "En la pestaña Integrantes, tocá “Sumar integrante”.",
        "En “¿Quién?” elegí “Es socio” y buscalo por nombre, apellido o número; tocá su nombre en la lista. Si no es socio, elegí “No es socio” y escribí el correo con el que tiene cuenta en FOTOFFICE.",
        "Elegí el Cargo (o “Sin cargo (sólo roles)”), marcá los Roles y, si querés, las fechas Desde y Hasta del mandato. Tocá “Sumar a la comisión”.",
      ],
      nota: "Un cargo que vota necesita al menos un rol, para que la persona pueda entrar al panel. Si dejás Desde vacío arranca hoy; si dejás Hasta vacío no vence.",
    },
    {
      titulo: "Cambiá los roles de alguien que ya está",
      texto: [
        "En la tarjeta de la persona tocá “Editar”. Marcá o desmarcá roles, ajustá las fechas y tocá “Guardar cambios”.",
        "El cargo no se cambia desde acá: para cambiarlo, quitá a la persona con “Quitar” y volvé a sumarla con el cargo nuevo. Lo anterior queda en el “Historial” al pie de la pantalla.",
      ],
    },
    {
      titulo: "Creá o editá un rol",
      texto: [
        "Andá a la pestaña Roles. Tocá “Nuevo rol” para crear uno, o “Editar permisos” en un rol que ya existe.",
        "Poné el Nombre del rol (por ejemplo, Tesorería) y una Descripción corta.",
      ],
    },
    {
      titulo: "Elegí qué puede hacer en cada parte del panel",
      texto: [
        "Para cada parte del panel (Socios, Cuotas societarias, Sorteos, Reservas y las demás que estén encendidas) elegí un nivel: “Sin acceso”, “Ver” (mira sin cambiar nada) o “Gestionar” (puede cargar, editar y borrar).",
        "Algunas partes, al elegir “Gestionar”, muestran casillas extra para acciones delicadas, como “Conducir sorteos” o “Configurar reservas”. Marcalas sólo si esa persona las necesita.",
        "Tocá “Crear rol” o “Guardar rol”.",
      ],
      nota: "Si un rol se parece al que necesitás, usá “Duplicar” y ajustá la copia. “Archivar” le quita el rol a quienes lo tienen; antes te pide confirmar nombrando a esas personas.",
    },
    {
      titulo: "Ordená los cargos",
      texto: [
        "En la pestaña Cargos ves la lista en el orden en que se muestran. Con “↑ Subir” y “↓ Bajar” los reordenás.",
        "Podés cambiar el Nombre del cargo y la casilla “Integra la comisión y vota” (un Revisor de cuentas, por ejemplo, no vota). Tocá “Guardar” en esa tarjeta.",
        "Para uno nuevo, completá “Nuevo cargo” al final y tocá “Crear cargo”.",
      ],
    },
  ],
};
