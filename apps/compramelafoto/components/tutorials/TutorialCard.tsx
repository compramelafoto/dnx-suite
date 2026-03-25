"use client";

import Card from "@/components/ui/Card";

type TutorialCardProps = {
  title: string;
  description?: string;
  youtubeId: string;
  thumbnailUrl: string;
};

export default function TutorialCard({ title, description, youtubeId }: TutorialCardProps) {
  const embedUrl = `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&playsinline=1&controls=0&fs=1&disablekb=1&iv_load_policy=3`;

  return (
    <Card className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
        <div className="w-full aspect-video overflow-hidden rounded-lg bg-black/5 relative">
          <iframe
            src={embedUrl}
            title={title}
            className="w-full h-full"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-presentation"
          />
        </div>
        <div className="text-left space-y-3">
          <h2 className="text-xl font-semibold text-[#1a1a1a]">{title}</h2>
          {description && (
            <p className="text-sm text-[#6b7280] whitespace-pre-line">{description}</p>
          )}
          <p className="text-xs text-[#9ca3af]">
            Reproducilo directamente acá, sin salir de la plataforma.
          </p>
        </div>
      </div>
    </Card>
  );
}
