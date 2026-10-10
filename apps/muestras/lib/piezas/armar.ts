import "server-only";
import { FRAME_BATCH_SIZE, catalogImageSize, parseHangingPlan, scanUrl } from "@repo/muestras";
import { pdfDeAficheLibro } from "./afiche-libro";
import { pdfDeCartel } from "./cartel";
import { pdfDeCatalogo, type ObraCatalogo } from "./catalogo";
import { imagenParaPdf } from "./imagen";
import { pdfDeMarcos, type ObraParaMarco } from "./marco";
import { pdfDeMontaje } from "./montaje";
import type { OpcionesPieza } from "./opciones";
import { autorDeObra, datosDeCartel, datosDeMontaje, detalleConExpositor, nombreDePieza, obraDeCatalogo, urlVisible, type MuestraParaPiezas } from "./textos";

/**
 * Arma el PDF pedido. Las fotos se procesan **una por vez**: en paralelo llenarían la memoria de la
 * función. Los marcos con foto de una muestra grande van por tandas de `FRAME_BATCH_SIZE` y el
 * catálogo achica las imágenes según la cantidad de obras (etapa 6, spec D18).
 * `null` = la obra o la tanda pedida no es de esta muestra (o no hay obras).
 */
export async function armarPieza(a: MuestraParaPiezas, o: OpcionesPieza, base: string): Promise<{ bytes: Uint8Array; nombre: string } | null> {
  const fecha = a.updatedAt;
  switch (o.pieza) {
    case "marcos": {
      const obras = o.obra
        ? a.works.filter((w) => w.id === o.obra)
        : o.tanda
          ? a.works.slice((o.tanda - 1) * FRAME_BATCH_SIZE, o.tanda * FRAME_BATCH_SIZE)
          : a.works;
      if (obras.length === 0) return null;
      const lista: ObraParaMarco[] = [];
      for (const w of obras) {
        // Sin foto igual se lee una chica: la ventana del remarco va a la proporción de la obra.
        lista.push({ titulo: w.title, autor: autorDeObra(w.authorName), detalle: detalleConExpositor(w, a.expositores?.get(w.id)), imagen: await imagenParaPdf(w.imageUrl, o.conFoto ? 2000 : 200, 88) });
      }
      const extra = [
        o.tamano,
        ...(o.obra ? [String(obras[0]!.sortOrder + 1)] : o.tanda ? [`tanda-${o.tanda}`] : []),
        ...(o.conFoto ? [] : ["remarco"]),
      ];
      return { bytes: await pdfDeMarcos(a.title, lista, o, fecha), nombre: nombreDePieza("marcos", a.slug, extra) };
    }
    case "cartel":
      return { bytes: await pdfDeCartel(datosDeCartel(a, base), o.tamano, fecha), nombre: nombreDePieza("cartel", a.slug, [o.tamano]) };
    case "catalogo": {
      if (a.works.length === 0) return null;
      const obras: ObraCatalogo[] = [];
      const lado = catalogImageSize(a.works.length);
      for (const w of a.works) {
        obras.push({ ...obraDeCatalogo(w, a.expositores?.get(w.id)), imagen: await imagenParaPdf(w.imageUrl, lado, 80) });
      }
      const datos = { ...datosDeCartel(a, base), urlVisible: urlVisible(base, `/m/${a.slug}`), portada: await imagenParaPdf(a.coverImageUrl, 1600, 82), obras };
      return { bytes: await pdfDeCatalogo(datos, o.tamano, fecha), nombre: nombreDePieza("catalogo", a.slug, [o.tamano]) };
    }
    case "libro":
      return {
        bytes: await pdfDeAficheLibro({ muestra: a.title, url: scanUrl(base, "l", a.id), urlVisible: urlVisible(base, `/m/${a.slug}/libro`) }, o.tamano, fecha),
        nombre: nombreDePieza("libro", a.slug, [o.tamano]),
      };
    case "montaje": {
      const { plan } = parseHangingPlan(a.hangingPlan, a.works.map((w) => w.id));
      return { bytes: await pdfDeMontaje(datosDeMontaje(a.title, plan, a.works), fecha), nombre: nombreDePieza("montaje", a.slug, []) };
    }
  }
}
