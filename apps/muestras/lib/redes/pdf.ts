import "server-only";
import { PDFDocument } from "pdf-lib";
import { PRINT_SIZES_MM } from "@repo/muestras";
import { MM } from "@/lib/piezas/dibujo";

/** La invitación para imprimir: la misma composición (300 ppp) a página completa, una sola hoja. */
export async function invitacionImprimible(jpg: Buffer, formato: "A6" | "A5"): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const { width, height } = PRINT_SIZES_MM[formato];
  const pagina = pdf.addPage([width * MM, height * MM]);
  const img = await pdf.embedJpg(jpg);
  pagina.drawImage(img, { x: 0, y: 0, width: width * MM, height: height * MM });
  pdf.setTitle("Invitación a la inauguración");
  pdf.setCreator("Muestras Fotográficas");
  pdf.setProducer("Muestras Fotográficas");
  pdf.setCreationDate(new Date(0));
  pdf.setModificationDate(new Date(0));
  return pdf.save();
}
