export type EmailTemplateKey =
  | "AUTH01_VERIFY_EMAIL"
  | "AUTH02_RESET_PASSWORD"
  | "AUTH03_PASSWORD_CHANGED"
  | "AUTH04_LOGIN_ALERT"
  | "ALBUM_E01"
  | "ALBUM_E02"
  | "ALBUM_E03"
  | "ALBUM_E04"
  | "ALBUM_E05"
  | "ALBUM_E06"
  | "ALBUM_E07"
  | "ALBUM_E08"
  | "ALBUM_INVITE"
  | "ALBUM_INTEREST_DIGEST"
  | "ADMIN_MANUAL"
  | "SUPPORT_REPLY";

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  templateKey?: EmailTemplateKey;
  meta?: {
    userId?: number;
    albumId?: number;
  };
};
