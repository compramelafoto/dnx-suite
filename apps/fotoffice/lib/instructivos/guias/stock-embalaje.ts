import type { Instructivo } from "../tipos";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";

export const guia: Instructivo = {
  slug: "stock-embalaje",
  titulo: "Sobres y bolsas: el embalaje de cada entrega",
  resumen:
    "Cargar los sobres y bolsas del local y decir cómo se entrega cada producto, para que cada venta descuente sola el embalaje que usa.",
  seccion: "Stock",
  moduleKey: SALES_MODULE_KEY,
  minutos: 8,
  pasos: [
    {
      titulo: "Por qué el embalaje va aparte de la receta",
      texto: [
        "La receta dice lo que gasta cada producto (una 10x15 gasta una copia del kit). El sobre, en cambio, va uno por entrega: 3 fotos o 80 fotos van en el mismo sobre.",
        "Por eso los sobres y bolsas se configuran en «Stock → Embalaje», y FOTOFFICE decide cuántos usa cada venta mirando todo lo que lleva.",
      ],
    },
    {
      titulo: "Cargá tus sobres y bolsas",
      texto: [
        "Entrá a «Ventas → Stock» y tocá «Embalaje». Si todavía no tenés ninguno, el botón «Cargar sobre 19x24 y bolsas negras» crea el sobre de papel y las bolsas 20x30, 30x45 y 35x45.",
        "De cada uno se indica lo más grande que entra. El sobre 19x24 admite fotos hasta 15x21; una bolsa 20x30 admite hasta 20x30. En el sobre, «Uno más cada 100» quiere decir que desde 100 fotos van 2 sobres, desde 200 van 3.",
        "Arrancan en cero: contá cuántos tenés y cargalo en Stock con «Ajustar por conteo».",
      ],
      nota: "Si una medida no es exacta, corregila ahí mismo y tocá «Guardar». Lo que dejes inactivo ya no se usa.",
    },
    {
      titulo: "Decí cómo se entrega cada producto",
      texto: [
        "Abajo está la lista de productos. A cada uno le elegís cómo se entrega: pieza suelta (fotos, pendrive), con marco (portarretratos, cuadros), volumen (fotolibro) o sin embalaje (servicios).",
        "Las fotos llevan su medida. Los portarretratos también, y tienen tildado «Bolsa más grande»: van en la bolsa siguiente a su medida, porque el marco ocupa más que la foto.",
        "FOTOFFICE propone una forma para cada producto según su nombre y su tamaño de impresión, marcada «sugerido». Revisala y tocá «Guardar»: nada se guarda solo.",
      ],
    },
    {
      titulo: "Qué descuenta solo",
      texto: [
        "30 fotos 10x15: 1 sobre. 120 fotos 10x15: 2 sobres.",
        "Una foto 20x30: 1 bolsa 20x30. Una 20x30 y una 30x45: una sola bolsa 30x45.",
        "Un portarretratos 13x18 con su foto: 1 bolsa 20x30 y ningún sobre, porque la foto va adentro del marco.",
        "Fotos chicas y una pieza grande: el sobre y la bolsa.",
      ],
    },
    {
      titulo: "Cambiarlo en el momento",
      texto: [
        "En el Cobrador, debajo del total, aparece «Embalaje: 1 sobre…». Si hoy usaste otra cosa, tocá «Cambiar», ajustá las cantidades y cobrá como siempre.",
        "En un pedido con seña el embalaje se descuenta al tomarlo. Si después hace falta otro sobre (por ejemplo, porque se entrega en dos partes), entrá al pedido y usá «Cambiar» en la tarjeta «Embalaje».",
      ],
      sistema: [
        "Cada venta, pedido con seña, presupuesto confirmado y pedido de impresión online descuenta solo su embalaje.",
        "Si anulás la venta, el embalaje vuelve. Si cancelás un pedido sin haber entregado nada, también; si ya entregaste algo, no, porque ya se usó.",
        "Vender nunca se frena por falta de sobres o bolsas: la existencia queda en negativo para que lo notes y repongas.",
      ],
    },
  ],
};
