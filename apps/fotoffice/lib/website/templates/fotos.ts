/**
 * Fotos de muestra de las plantillas. Todas de Unsplash (licencia libre, uso comercial
 * permitido); autor y página de cada una en `CREDITOS.md`, al lado de este archivo. Nunca fotos
 * de clientes de FOTOFFICE ni de CompraMeLaFoto.
 *
 * Hoy se enlazan al CDN de Unsplash (`images.unsplash.com`): los bloques aceptan cualquier host
 * (el schema sólo limita el largo, el sitio no tiene `img-src` en su CSP) y se dibujan con el
 * mismo `<img>`/`background-image` que una foto subida. PENDIENTE: subir las copias a R2 en
 * `claveR2` (`fotoffice-media/fotoffice/plantillas/<plantilla>/<n>.jpg`) y cambiar `url` a la
 * dirección pública del bucket — la subida necesita un permiso que esta tanda no tuvo (ver
 * `CREDITOS.md`). Ojo: al aplicar una plantilla la dirección queda copiada en el sitio del
 * usuario, que la reemplaza por sus fotos.
 */

const cdn = (photoId: string) => `https://images.unsplash.com/${photoId}?w=1920&q=80&auto=format&fit=crop`;

export type FotoDeMuestra = {
  url: string;
  /** Dónde va (o está) la copia en `fotoffice-media`. Fuera de los prefijos borrables a propósito
   * (`r2-key-policy.ts`): la comparten todos los sitios que aplicaron la plantilla. */
  claveR2: string;
  alt: string;
  autor: string;
  /** Página de la foto en Unsplash (créditos). */
  pagina: string;
};

function foto(photoId: string, unsplashId: string, autor: string, alt: string, claveR2: string): FotoDeMuestra {
  return { url: cdn(photoId), claveR2, alt, autor, pagina: `https://unsplash.com/photos/${unsplashId}` };
}

export const FOTOS_DE_MUESTRA = {
  // Eventos: XV, bodas, fiesta.
  quinceTiara: foto("photo-1763625639434-b11b8d8aa65f", "TLXLMxZMc94", "Quinces Perfectos", "Quinceañera con vestido celeste y tiara", "fotoffice/plantillas/eventos/1.jpg"),
  quinceParque: foto("photo-1763625639146-1d815371c289", "Y6WFOm0Bk0w", "Quinces Perfectos", "Quinceañera caminando por un parque", "fotoffice/plantillas/eventos/3.jpg"),
  novios: foto("photo-1759271493839-be0cf1d86537", "syhdOrkx-98", "Josh Batres", "Novios abrazados el día de su casamiento", "fotoffice/plantillas/eventos/2.jpg"),
  noviosLago: foto("photo-1646325311277-0c35409fdd57", "fwFuglNcxNo", "Anthony Tran", "Novios frente a un lago", "fotoffice/plantillas/eventos/4.jpg"),
  brindis: foto("photo-1521321335080-61c4776db11b", "QupD32n3bGQ", "Photos by Lanty", "Brindis en una fiesta", "fotoffice/plantillas/eventos/5.jpg"),
  noviosAtardecer: foto("photo-1761211488163-67bc659a8180", "AD3k4pko7wo", "John Marfe Bitoon", "Novios al atardecer", "fotoffice/plantillas/eventos/6.jpg"),
  noviosMadera: foto("photo-1595407753234-0882f1e77954", "JFAPl7brL6U", "Victoria Priessnitz", "Novios junto a una pared de madera", "fotoffice/plantillas/estudio/6.jpg"),
  noviosEscalera: foto("photo-1710587385535-c406510a1c22", "mVovNhvgDqM", "Kari Bjorn Photography", "Novios en una escalera", "fotoffice/plantillas/retrato-editorial/3.jpg"),
  noviosCampo: foto("photo-1606490208247-b65be3d94cd1", "lR--zjgQRY0", "Jakob Owens", "Novios en un campo", "fotoffice/plantillas/retrato-editorial/5.jpg"),
  noviosParaguas: foto("photo-1647404297985-28e37069f7d3", "ob70jH_KIXM", "Taylor Gray", "Novios bajo un paraguas", "fotoffice/plantillas/retrato-editorial/4.jpg"),
  parejaPared: foto("photo-1544717304-14d94551b7dc", "IsRIjvgpj5Y", "Icons8 Team", "Novios en estudio, con fondo liso", "fotoffice/plantillas/estudio/4.jpg"),
  // Retratos de estudio y editoriales.
  retratoEncaje: foto("photo-1622738010740-4b8e34702474", "YOUjEnOT24I", "Chalo Garcia", "Retrato de estudio con blusa de encaje", "fotoffice/plantillas/estudio/1.jpg"),
  retratoAnteojos: foto("photo-1744901581831-3ffe7d3d05f5", "Ns6htPkdLXw", "Sunabi Studios", "Retrato con anteojos de sol", "fotoffice/plantillas/estudio/2.jpg"),
  retratoSonrisa: foto("photo-1645963053605-25f01c33ca02", "Ri93ksQlI34", "Ethan Rougon", "Retrato sonriendo a cámara", "fotoffice/plantillas/estudio/3.jpg"),
  retratoEstudio: foto("photo-1612248605813-7aaffaec2a87", "IRCjbZGmbso", "Alwin Thomas", "Retrato en penumbra", "fotoffice/plantillas/estudio/5.jpg"),
  retratoFondoNegro: foto("photo-1577091937200-29915517c0bd", "3dL0mzyUS6M", "Denis Agati", "Retrato sentada sobre fondo negro", "fotoffice/plantillas/retrato-editorial/1.jpg"),
  retratoEditorial: foto("photo-1708448903646-fc3ba372cbc7", "WubwJbyD7iQ", "Ernan Solozabal", "Retrato editorial", "fotoffice/plantillas/retrato-editorial/2.jpg"),
  // Ciudad y paisaje urbano.
  calleNoche: foto("photo-1635942288176-f9542e072bdd", "CfQYiz-uexw", "Ali Shah Lakhani", "Calle de noche con luces de autos", "fotoffice/plantillas/oscura/1.jpg"),
  ciudadAtardecer: foto("photo-1766086892241-ffb6cc6992f6", "TFZ7YLePsv0", "Josh Hild", "Calle entre edificios al atardecer", "fotoffice/plantillas/oscura/6.jpg"),
  calleOscura: foto("photo-1571175136195-a0d98b925ea9", "kMYnB4oejVw", "Carson van Tol", "Calle oscura con un farol", "fotoffice/plantillas/oscura/3.jpg"),
  puenteNoche: foto("photo-1706498133899-f1cf5a6af53e", "o_fSNj4IAMI", "Julius Carmine", "Ciudad de noche con un puente", "fotoffice/plantillas/oscura/4.jpg"),
  ciudadLuces: foto("photo-1575090973547-6c9387c8f9e7", "5IVa9hrd9x4", "Jake Weirick", "Ciudad de noche", "fotoffice/plantillas/oscura/5.jpg"),
  asfaltoMojado: foto("photo-1520050984229-709501d9c1ff", "6qRtgy2mpFE", "Andreas Rasmussen", "Ciudad de noche con el asfalto mojado", "fotoffice/plantillas/oscura/2.jpg"),
} as const satisfies Record<string, FotoDeMuestra>;
