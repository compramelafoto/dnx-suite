"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { courseEntries, extractYoutubeId, formatLessonDuration, type TutorialCourse } from "@/lib/tutorials/course";

type Props = {
  course: Pick<TutorialCourse, "blocks" | "details" | "lessonCount" | "extras">;
  /** Número de clase → link de YouTube. */
  videos: Record<number, string>;
};

const AUDIENCE_DOT: Record<string, string> = {
  Fotógrafo: "bg-[#c27b3d]",
  "Fotógrafo y colegio": "bg-[#c27b3d]",
  "Fotógrafo y turista": "bg-[#c27b3d]",
  "Fotógrafo y empresa de turismo": "bg-[#c27b3d]",
  Colegio: "bg-[#2f7a6d]",
  "Empresa de turismo": "bg-[#2f7a6d]",
  Familia: "bg-[#3d6aa8]",
  Turista: "bg-[#3d6aa8]",
};

function audienceLabel(audience: string): string {
  return `Para ${audience
    .split(" y ")
    .map((who) => `${/^(familia|empresa)/i.test(who) ? "la" : "el"} ${who.toLowerCase()}`)
    .join(" y ")}`;
}

function audienceDot(audience: string): string {
  return AUDIENCE_DOT[audience] ?? "bg-[#9ca3af]";
}

function lessonFromHash(keys: string[]): string | null {
  if (typeof window === "undefined") return null;
  const match = window.location.hash.match(/^#clase-([a-z0-9]+)$/);
  return match && keys.includes(match[1]) ? match[1] : null;
}

export default function CoursePlayer({ course, videos }: Props) {
  const { blocks, details, lessonCount, extras } = course;
  const LESSONS = useMemo(() => courseEntries({ blocks, details, extras }, videos), [blocks, details, extras, videos]);
  const firstAvailable = (LESSONS.find((l) => l.videoUrl) ?? LESSONS[0]).key;
  const [current, setCurrent] = useState(firstAvailable);
  const [start, setStart] = useState<{ at: number; autoplay: boolean }>({ at: 0, autoplay: false });
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fromHash = lessonFromHash(LESSONS.map((l) => l.key));
    if (fromHash) setCurrent(fromHash);
  }, [LESSONS]);

  const lesson = LESSONS.find((l) => l.key === current) ?? LESSONS[0];
  const detail = lesson.detail;
  const youtubeId = lesson.videoUrl ? extractYoutubeId(lesson.videoUrl) : null;
  const totalSeconds = useMemo(
    () => LESSONS.reduce((sum, l) => sum + (l.detail?.durationSeconds ?? 0), 0),
    [LESSONS]
  );

  const open = useCallback((key: string, at = 0, autoplay = true) => {
    setCurrent(key);
    setStart({ at, autoplay });
    window.history.replaceState(null, "", `#clase-${key}`);
    const top = playerRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0 || top > window.innerHeight * 0.5) {
      playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const index = LESSONS.findIndex((l) => l.key === lesson.key);
  const previous = LESSONS[index - 1];
  const next = LESSONS[index + 1];
  const embedSrc = youtubeId
    ? `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&playsinline=1&start=${start.at}${
        start.autoplay ? "&autoplay=1" : ""
      }`
    : null;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <div ref={playerRef} className="scroll-mt-24">
        <div className="aspect-video w-full overflow-hidden rounded-2xl bg-[#1a1a1a] shadow-[0_24px_60px_-30px_rgba(26,26,26,0.6)]">
          {embedSrc ? (
            <iframe
              key={embedSrc}
              src={embedSrc}
              title={lesson.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-presentation"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-white/70">
              Esta clase todavía no está publicada.
            </div>
          )}
        </div>

        <div className="mt-6 max-w-[68ch]">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#6b7280]">
            <span className="font-semibold text-[#9a5c2a]">
              {lesson.number === null ? `Clase ${lesson.label}` : `Clase ${lesson.number} de ${lessonCount}`}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${audienceDot(lesson.audience)}`} aria-hidden />
              {audienceLabel(lesson.audience)}
            </span>
            {detail && <span className="tabular-nums">{formatLessonDuration(detail.durationSeconds)}</span>}
          </p>
          <h2 className="mt-2 text-2xl font-semibold leading-tight text-[#1a1a1a] md:text-[2rem]">{lesson.title}</h2>
          {detail?.description.split("\n\n").map((paragraph) => (
            <p key={paragraph} className="mt-4 text-[1.0625rem] leading-relaxed text-[#374151]">
              {paragraph}
            </p>
          ))}

          {detail && detail.chapters.length > 0 && youtubeId && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-[#1a1a1a]">Saltá a una parte</h3>
              <ol className="mt-2 divide-y divide-[#ece7df] border-y border-[#ece7df]">
                {detail.chapters.map((chapter) => (
                  <li key={chapter.at}>
                    <button
                      type="button"
                      onClick={() => open(lesson.key, chapter.at)}
                      className="flex w-full items-baseline gap-4 py-2.5 text-left text-[0.95rem] text-[#374151] hover:text-[#9a5c2a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c27b3d]"
                    >
                      <span className="w-10 shrink-0 tabular-nums text-[#9a5c2a]">
                        {formatLessonDuration(chapter.at)}
                      </span>
                      <span>{chapter.label}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            {previous && (
              <button type="button" onClick={() => open(previous.key)} className="clf-btn clf-btn--outline">
                Clase anterior
              </button>
            )}
            {next && (
              <button type="button" onClick={() => open(next.key)} className="clf-btn clf-btn--primary h-auto max-w-full whitespace-normal py-3 text-left leading-snug">
                Siguiente: {next.title}
              </button>
            )}
          </div>
        </div>
      </div>

      <nav aria-label="Clases del curso" className="lg:sticky lg:top-24">
        <div className="rounded-2xl border border-[#ece7df] bg-white">
          <p className="border-b border-[#ece7df] px-5 py-4 text-sm text-[#6b7280]">
            <span className="font-semibold text-[#1a1a1a]">{lessonCount} clases</span>
            {Object.keys(details).length === lessonCount
              ? `, unos ${Math.round(totalSeconds / 60)} minutos en total`
              : ""}
          </p>
          <div className="max-h-none overflow-y-auto lg:max-h-[calc(100vh-11rem)]">
            {blocks.map((block, blockIndex) => (
              <section key={block.title} className="border-b border-[#ece7df] last:border-b-0">
                <h3 className="px-5 pt-4 pb-1 text-[0.8rem] font-semibold text-[#6b7280]">
                  Bloque {blockIndex + 1}: {block.title}
                </h3>
                <ol className="pb-2">
                  {LESSONS.filter((item) => item.blockIndex === blockIndex).map((item) => {
                    const active = item.key === lesson.key;
                    const available = Boolean(item.videoUrl);
                    const d = item.detail;
                    return (
                      <li key={item.key}>
                        <button
                          type="button"
                          onClick={() => open(item.key)}
                          aria-current={active ? "true" : undefined}
                          className={`group flex w-full items-start gap-3 border-l-[3px] px-5 py-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#c27b3d] ${
                            active
                              ? "border-[#c27b3d] bg-[#fbf4ec]"
                              : "border-transparent hover:bg-[#faf8f5]"
                          }`}
                        >
                          <span
                            className={`mt-0.5 w-7 shrink-0 text-right text-sm tabular-nums ${
                              active ? "font-semibold text-[#9a5c2a]" : "text-[#9ca3af]"
                            }`}
                          >
                            {item.label}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block text-[0.95rem] leading-snug ${
                                active ? "font-semibold text-[#1a1a1a]" : "text-[#374151]"
                              }`}
                            >
                              {item.title}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-[#9ca3af]">
                              <span className={`h-1.5 w-1.5 rounded-full ${audienceDot(item.audience)}`} aria-hidden />
                              {available && d ? formatLessonDuration(d.durationSeconds) : "Próximamente"}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}
