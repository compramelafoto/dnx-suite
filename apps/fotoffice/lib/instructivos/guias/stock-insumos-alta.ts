import type { Instructivo } from "../tipos";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";

export const guia: Instructivo = {
  slug: "stock-insumos-alta",
  titulo: "Dar de alta un insumo",
  resumen:
    "Cargar lo que se gasta pero no se vende (papel, tinta, kits) para llevar su existencia, y dejar listo el kit de la Kodak 305.",
  seccion: "Stock",
  moduleKey: SALES_MODULE_KEY,
  minutos: 5,
  pasos: [
    {
      titulo: "Un insumo es lo que se gasta, no lo que se vende",
      texto: [
        "Papel fotográfico, tinta, sobres, el kit de la impresora: el cliente no los compra, pero se acaban. Cargándolos como «Insumo», FOTOFFICE te dice cuánto queda y te avisa cuándo reponer.",
      ],
    },
    {
      titulo: "Creá el insumo en el catálogo",
      texto: [
        "Entrá a «Catálogo» y tocá «Nuevo producto».",
        "Escribí el nombre (por ejemplo «Sobres de carnet») y en «Tipo» elegí «Insumo». El formulario cambia: desaparece el precio y aparece la sección «Insumo».",
      ],
      nota: "Para ver sólo los insumos que ya cargaste, tildá «Sólo insumos» arriba del listado del catálogo.",
    },
    {
      titulo: "Decí en qué se cuenta",
      texto: [
        "En «¿En qué se cuenta?» escribí la unidad: «copias», «sobres», «ml»… Es la palabra que vas a ver al lado de la existencia.",
        "En «Mínimo antes de avisar» poné cuántas unidades tienen que quedar como mínimo. Por debajo de ese número, el insumo aparece en «Para reponer».",
      ],
    },
    {
      titulo: "Decí cómo lo comprás (si hace falta)",
      texto: [
        "Muchos insumos se compran en cajas o kits pero se gastan de a una unidad. Para eso están «Cómo lo comprás (opcional)» y «Cuántas unidades trae cada una».",
        "Ejemplo: el kit de la Kodak 305 se compra como «Kit 305 6R» y trae 640 copias. En «Cómo lo comprás» escribís «Kit 305 6R» y en «Cuántas unidades trae cada una» escribís 640.",
        "Así, cuando llegue un kit, cargás «1 kit» y FOTOFFICE suma 640 copias. Al terminar, tocá «Crear producto» (si estás editando uno que ya existe, «Guardar cambios»).",
      ],
      sistema: ["Los insumos no aparecen en el Cobrador ni en la tienda: no se pueden vender por error."],
    },
    {
      titulo: "La Kodak 305, con un botón",
      texto: [
        "Si tenés la Kodak 305, no hace falta cargar nada a mano. Entrá a «Stock» y, en la tarjeta «Controlá el ribbon de la Kodak 305», tocá «Configurar».",
        "Se crea el kit como insumo (en «copias 10x15», con «Kit 305 6R» de 640 copias) y arranca en cero. Después contá cuántas copias le quedan al ribbon y cargalas con «Ajustar por conteo» (mirá la guía «Contar lo que hay y corregir»).",
      ],
      sistema: [
        "Deja armado el consumo de la impresora por tamaño: 10x15 gasta 1 copia, 13x18 gasta 2 y 15x20 gasta 2.",
      ],
      nota: "La tarjeta «Configurar» desaparece sola cuando el kit ya está armado. Tocarla de nuevo no duplica nada.",
    },
  ],
};
