export type PlaceholderValue = string | number | null;

export type PlaceholderMap = Record<string, PlaceholderValue>;

export type TemplateSlotRole =
  | "PHOTO_MAIN"
  | "PHOTO_1"
  | "PHOTO_2"
  | "PHOTO_3"
  | "GROUP_PHOTO"
  | "SCHOOL_LOGO"
  | "FOOTER_LOGO"
  | "BANNER";

export type SelectionPhotoRole =
  | "PHOTO_MAIN"
  | "PHOTO_1"
  | "PHOTO_2"
  | "PHOTO_3"
  | "GROUP_PHOTO";

export type TemplateTextAlign = "left" | "center" | "right";

export type TemplateVerticalAlign = "top" | "middle" | "bottom";

export type TemplateTextElement = {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: number | string;
  color: string;
  align: TemplateTextAlign;
  verticalAlign?: TemplateVerticalAlign;
  lineHeight?: number;
  maxLines?: number;
  visible?: boolean;
  required?: boolean;
};

export type TemplateSlotSpec = {
  id?: string;
  index: number;
  pageIndex: number;
  bbox: { x: number; y: number; width: number; height: number };
  role?: TemplateSlotRole | null;
  maskPngUrl?: string | null;
  required?: boolean;
};

export type TemplateOverlay = {
  imageUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
};

export type TemplatePageSpec = {
  pageIndex: number;
  width: number;
  height: number;
  background?: { imageUrl?: string | null; color?: string | null };
  slots?: TemplateSlotSpec[];
  textElements?: string[];
  overlays?: TemplateOverlay[];
};

export type SchoolTemplateSource = {
  id: number;
  imageUrl: string;
  widthCm: number;
  heightCm: number;
  textElementsJson?: TemplateTextElement[] | null;
  pagesJson?: TemplatePageSpec[] | null;
  slots: TemplateSlotSpec[];
};

export type SelectedPhoto = {
  id: number;
  role?: SelectionPhotoRole | null;
};

export type SchoolTemplateRenderInput = {
  template: SchoolTemplateSource;
  placeholders: PlaceholderMap;
  photos: SelectedPhoto[];
  assets?: {
    schoolLogoUrl?: string | null;
    footerLogoUrl?: string | null;
    bannerUrl?: string | null;
    groupPhotoId?: number | null;
  };
};
