import { Facebook, Instagram, Linkedin, Youtube } from "lucide-react";
import type { SVGProps } from "react";
import type { SiteSocialNetwork } from "@/lib/website/site-settings";

/**
 * Íconos de las redes del pie. Lucide (la librería de íconos del proyecto) trae Instagram,
 * Facebook, YouTube y LinkedIn; las demás no las tiene, así que van dibujadas acá con el mismo
 * estilo de trazo (24×24, `currentColor`). Sin dependencias nuevas.
 */
type IconProps = { className?: string };

function Trazo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

function XIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <path d="M4 4l11.7 16H20L8.3 4z" />
      <path d="M4 20l6.8-6.8M13.2 10.8L20 4" />
    </Trazo>
  );
}

function TiktokIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <path d="M14 3v11.5a4.5 4.5 0 1 1-4.5-4.5" />
      <path d="M14 3c0 2.8 2.2 5 5 5" />
    </Trazo>
  );
}

function PinterestIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M10.5 21.5l2.2-9.3" />
      <path d="M9.2 14.6c-1-.6-1.6-1.7-1.6-3 0-2.6 2-4.6 4.6-4.6 2.5 0 4.2 1.8 4.2 4.1 0 2.7-1.5 4.7-3.5 4.7-1 0-1.7-.6-1.5-1.5" />
    </Trazo>
  );
}

function VimeoIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <path d="M3 8.5l1 1.2c1.3-1 2.2-1.3 2.6-.3.6 1.6 1.6 5.7 2.4 7.5.6 1.4 1.4 1.6 2.6.6C14.2 15.4 19 10.4 20.4 7c.9-2.2-.4-3.6-2.4-3.3-1.8.3-3.4 2-4 3.9 1.6-.8 2.7-.2 2 1.7-.6 1.5-2.3 4.1-3 4.1-.8 0-1.7-5.5-2.3-7-.6-1.6-2.1-1.6-3.4-.7C6 6.6 4.4 7.4 3 8.5z" />
    </Trazo>
  );
}

function FlickrIcon({ className }: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <circle cx="6.5" cy="12" r="4.5" />
      <circle cx="17.5" cy="12" r="4.5" opacity="0.6" />
    </svg>
  );
}

export function SocialIcon({ network, className }: { network: SiteSocialNetwork; className?: string }) {
  switch (network) {
    case "instagram":
      return <Instagram className={className} aria-hidden="true" />;
    case "facebook":
      return <Facebook className={className} aria-hidden="true" />;
    case "youtube":
      return <Youtube className={className} aria-hidden="true" />;
    case "linkedin":
      return <Linkedin className={className} aria-hidden="true" />;
    case "x":
      return <XIcon className={className} />;
    case "tiktok":
      return <TiktokIcon className={className} />;
    case "pinterest":
      return <PinterestIcon className={className} />;
    case "vimeo":
      return <VimeoIcon className={className} />;
    case "flickr":
      return <FlickrIcon className={className} />;
  }
}
