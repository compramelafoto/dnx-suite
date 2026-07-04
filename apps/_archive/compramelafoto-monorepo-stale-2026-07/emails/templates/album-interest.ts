import { emailSignature } from "../signature";

type AlbumInterestParams = {
  firstName?: string;
  albumTitle: string;
  eventName?: string;
  albumUrl: string;
  daysLeft: number;
  expiresAt: string;
  reactivateUrl: string;
};

function wrapEmail(content: string) {
  return `
  <div style="font-family: Arial, sans-serif; font-size: 15px; color: #111827; line-height: 1.6;">
    ${content}
    ${emailSignature()}
  </div>
  `.trim();
}

function greet(firstName?: string) {
  return firstName ? `Hola ${firstName},` : "Hola,";
}

function titleLine(albumTitle: string, eventName?: string) {
  if (eventName) {
    return `${albumTitle} · ${eventName}`;
  }
  return albumTitle;
}

function reactivateNotice(sequence: string) {
  if (sequence === "E06" || sequence === "E07" || sequence === "E08") {
    return `<p style="font-size: 13px; color: #6b7280;">Al reactivar, los precios pueden cambiar.</p>`;
  }
  return "";
}

function buildEmail(sequence: string, params: AlbumInterestParams, subject: string, intro: string) {
  const { firstName, albumTitle, eventName, albumUrl, daysLeft, expiresAt, reactivateUrl } = params;
  const html = wrapEmail(`
    <p>${greet(firstName)}</p>
    <p><strong>${titleLine(albumTitle, eventName)}</strong></p>
    <p>${intro}</p>
    <p>
      <a href="${albumUrl}" style="display: inline-block; background: #c27b3d; color: #ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">
        Ver álbum
      </a>
    </p>
    <p style="font-size: 13px; color: #6b7280;">
      Quedan ${daysLeft} días. Vence el ${expiresAt}.
    </p>
    <p>
      Si querés reactivar el álbum, podés hacerlo acá:
      <a href="${reactivateUrl}" style="color: #c27b3d; text-decoration: none;">Reactivar álbum</a>
    </p>
    ${reactivateNotice(sequence)}
  `);
  return { subject, html };
}

export function buildAlbumInterestE01(params: AlbumInterestParams) {
  return buildEmail(
    "E01",
    params,
    "Tus fotos siguen disponibles",
    "Te esperamos para que veas y compres tus fotos cuando quieras."
  );
}

export function buildAlbumInterestE02(params: AlbumInterestParams) {
  return buildEmail(
    "E02",
    params,
    "Recordatorio: tus fotos siguen activas",
    "Todavía estás a tiempo de elegir tus fotos favoritas."
  );
}

export function buildAlbumInterestE03(params: AlbumInterestParams) {
  return buildEmail(
    "E03",
    params,
    "Quedan pocos días para el álbum",
    "Antes de que cierre, pasá a mirar el álbum."
  );
}

export function buildAlbumInterestE04(params: AlbumInterestParams) {
  return buildEmail(
    "E04",
    params,
    "Últimos días para comprar tus fotos",
    "Queríamos avisarte que el álbum está por vencer."
  );
}

export function buildAlbumInterestE05(params: AlbumInterestParams) {
  return buildEmail(
    "E05",
    params,
    "Último aviso antes del cierre",
    "Si querés comprar, este es un buen momento para hacerlo."
  );
}

export function buildAlbumInterestE06(params: AlbumInterestParams) {
  return buildEmail(
    "E06",
    params,
    "El álbum está por cerrar",
    "Podés reactivarlo si querés más tiempo."
  );
}

export function buildAlbumInterestE07(params: AlbumInterestParams) {
  return buildEmail(
    "E07",
    params,
    "Cierre inminente del álbum",
    "Si querés seguir accediendo, reactivá el álbum."
  );
}

export function buildAlbumInterestE08(params: AlbumInterestParams) {
  return buildEmail(
    "E08",
    params,
    "El álbum ya venció",
    "Todavía podés reactivarlo para volver a acceder."
  );
}

type AlbumInterestDigestParams = {
  firstName?: string;
  albums: {
    title: string;
    url: string;
  }[];
};

export function buildAlbumInterestDigest(params: AlbumInterestDigestParams) {
  const { firstName, albums } = params;
  const itemsHtml = albums
    .map(
      (album) => `
        <li style="margin-bottom: 8px;">
          <a href="${album.url}" style="color: #c27b3d; text-decoration: none;">
            ${album.title}
          </a>
        </li>
      `
    )
    .join("");

  const html = wrapEmail(`
    <p>${greet(firstName)}</p>
    <p>Estos son los álbumes que tenés pendientes para ver y comprar:</p>
    <ul style="padding-left: 18px; margin: 12px 0;">
      ${itemsHtml}
    </ul>
    <p>
      Abrí el que quieras y elegí tus fotos favoritas.
    </p>
  `);

  return {
    subject: "Tus álbumes de interés",
    html,
  };
}
