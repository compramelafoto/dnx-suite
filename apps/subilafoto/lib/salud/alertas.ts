/**
 * Qué merece que alguien mire, ahora.
 *
 * Un panel de salud que muestra números no sirve a la una de la mañana. Lo que hace falta
 * es una lista corta de cosas que están mal y, al lado de cada una, **qué hacer**. Por eso
 * cada alerta trae su instrucción: el que la lee está apurado y probablemente no sea quien
 * escribió esto.
 *
 * Puro: recibe conteos, devuelve la lista.
 */

export type Conteos = {
  /** En `PROCESSING` desde hace más de diez minutos. */
  fotosTrabadas: number;
  /** Aprobadas y sin variante: no se ven en ningún lado. */
  fotosSinVariante: number;
  paquetesFallados: number;
  correosFallados: number;
  /** Órdenes pagadas sin evento creado. Entró la plata y no hay qué entregar. */
  pagosSinEvento: number;
  /** Eventos cuya ventana venció y siguen abiertos. */
  eventosSinCerrar: number;
};

export type Gravedad = "grave" | "aviso";

export type Alerta = {
  clave: string;
  gravedad: Gravedad;
  titulo: string;
  queHacer: string;
};

/** Arriba de este número, una demora pasa a ser un problema. */
const MUCHAS_FOTOS = 10;

export function alertasDeLosDatos(c: Conteos): Alerta[] {
  const alertas: Alerta[] = [];

  /*
    Primero la plata. Es lo único de esta lista que no se arregla solo con el tiempo y lo
    único donde alguien ya pagó y no tiene nada.
  */
  if (c.pagosSinEvento > 0) {
    alertas.push({
      clave: "pagos-sin-evento",
      gravedad: "grave",
      titulo: `${c.pagosSinEvento} ${c.pagosSinEvento === 1 ? "pago acreditado" : "pagos acreditados"} sin evento creado`,
      queHacer:
        "La plata entró y el evento no se creó. Buscá el motivo en los registros con «no se pudo crear el evento» y creá el evento a mano desde el panel.",
    });
  }

  if (c.fotosTrabadas > 0) {
    alertas.push({
      clave: "fotos-trabadas",
      gravedad: c.fotosTrabadas >= MUCHAS_FOTOS ? "grave" : "aviso",
      titulo: `${c.fotosTrabadas} ${c.fotosTrabadas === 1 ? "foto lleva" : "fotos llevan"} más de diez minutos sin decidirse`,
      queHacer:
        "Dispará /api/moderacion/procesar a mano. Si vuelven a trabarse, mirá la parte «moderacion» del diagnóstico: puede ser la credencial de Amazon.",
    });
  }

  if (c.eventosSinCerrar > 0) {
    alertas.push({
      clave: "eventos-sin-cerrar",
      gravedad: "aviso",
      titulo: `${c.eventosSinCerrar} ${c.eventosSinCerrar === 1 ? "evento venció" : "eventos vencieron"} y siguen abiertos`,
      queHacer:
        "Dispará /api/eventos/cerrar a mano. Cerrar no interrumpe nada en curso: una foto que entró antes se modera igual.",
    });
  }

  if (c.paquetesFallados > 0) {
    alertas.push({
      clave: "paquetes-fallados",
      gravedad: "grave",
      titulo: `${c.paquetesFallados} ${c.paquetesFallados === 1 ? "paquete falló" : "paquetes fallaron"} al armarse`,
      queHacer:
        "El motivo está en la columna «error» del paquete. Son clientes que pagaron la descarga y todavía no la tienen.",
    });
  }

  if (c.correosFallados > 0) {
    alertas.push({
      clave: "correos-fallados",
      gravedad: "aviso",
      titulo: `${c.correosFallados} ${c.correosFallados === 1 ? "correo no salió" : "correos no salieron"}`,
      queHacer:
        "El motivo está en la columna «error». Un aviso que falla no se reintenta: es preferible perderlo a mandarlo dos veces.",
    });
  }

  if (c.fotosSinVariante > 0) {
    alertas.push({
      clave: "fotos-sin-variante",
      gravedad: "aviso",
      titulo: `${c.fotosSinVariante} ${c.fotosSinVariante === 1 ? "foto aprobada no se ve" : "fotos aprobadas no se ven"}`,
      queHacer:
        "Les falta la versión reducida y por eso no aparecen ni en el álbum ni en la pantalla. El cron de moderación las levanta de a cinco: corrélo un par de veces.",
    });
  }

  const peso = (g: Gravedad) => (g === "grave" ? 0 : 1);
  return alertas.sort((a, b) => peso(a.gravedad) - peso(b.gravedad));
}
