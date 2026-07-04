import type { AlbumMode } from "@prisma/client";

type AlbumModeOption = {
  value: AlbumMode;
  label: string;
  description: string;
};

export const albumModeOptions: AlbumModeOption[] = [
  {
    value: "SIMPLE",
    label: "Álbum simple",
    description: "Para vender fotos sueltas sin configuraciones avanzadas.",
  },
  {
    value: "EVENT",
    label: "Evento / deporte",
    description:
      "Para eventos deportivos, sociales o culturales donde podés vender fotos sueltas y packs digitales.",
  },
  {
    value: "SCHOOL",
    label: "Escolar",
    description:
      "Para trabajos escolares con preventa, carpetas, selección de fotos y diseños.",
  },
  {
    value: "COLLABORATIVE",
    label: "Evento colaborativo",
    description:
      "Para eventos donde participan varios fotógrafos y se arma una galería colaborativa.",
  },
];
