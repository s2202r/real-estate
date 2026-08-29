"use client";

import { useState } from "react";
import Image from "next/image";
import { Building2, ChevronLeft, ChevronRight, Expand, ExternalLink, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { isEmbeddable } from "@/config/embeds";

export interface GalleryItem {
  readonly id: string;
  readonly type: "IMAGE" | "VIDEO" | "YOUTUBE" | "TOUR_360" | "FLOOR_PLAN" | "VIRTUAL_TOUR";
  readonly url: string;
  readonly caption?: string | null;
  readonly alt?: string | null;
}

/**
 * Property gallery and media viewer.
 *
 * One component handles photographs, video, YouTube embeds, 360 tours and floor
 * plans, because a property's media is heterogeneous and a separate widget per
 * type produces an inconsistent experience.
 *
 * Third-party embeds are only rendered inside the lightbox, on demand — never
 * on initial load, where they would cost a large third-party payload before the
 * customer has asked for it.
 */
export function PropertyGallery({
  items,
  title,
  className,
}: {
  items: readonly GalleryItem[];
  title: string;
  className?: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "flex aspect-[16/10] items-center justify-center rounded-xl border bg-muted",
          className,
        )}
      >
        <Building2 className="size-12 text-muted-foreground/40" aria-hidden />
        <span className="sr-only">No photographs available for this property</span>
      </div>
    );
  }

  const active = items[activeIndex] ?? items[0]!;
  const go = (delta: number) =>
    setActiveIndex((current) => (current + delta + items.length) % items.length);

  return (
    <div className={className}>
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-muted">
        {active.type === "IMAGE" || active.type === "FLOOR_PLAN" ? (
          <Image
            src={active.url}
            alt={active.alt ?? active.caption ?? title}
            fill
            priority={activeIndex === 0}
            sizes="(min-width: 1024px) 60vw, 100vw"
            className={cn(
              "object-cover",
              active.type === "FLOOR_PLAN" && "bg-background object-contain p-4",
            )}
          />
        ) : (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="group flex size-full items-center justify-center bg-foreground/90"
          >
            <span className="flex size-16 items-center justify-center rounded-full bg-background/90 transition-transform group-hover:scale-110">
              <Play className="size-6 translate-x-0.5" aria-hidden />
            </span>
            <span className="sr-only">Play {active.caption ?? "media"}</span>
          </button>
        )}

        {items.length > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-3 top-1/2 -translate-y-1/2 shadow-md"
              onClick={() => go(-1)}
              aria-label="Previous image"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-3 top-1/2 -translate-y-1/2 shadow-md"
              onClick={() => go(1)}
              aria-label="Next image"
            >
              <ChevronRight />
            </Button>
          </>
        )}

        <Button
          variant="secondary"
          size="sm"
          className="absolute bottom-3 right-3 shadow-md"
          onClick={() => setLightboxOpen(true)}
        >
          <Expand aria-hidden />
          View
        </Button>

        <Badge variant="secondary" className="tabular absolute bottom-3 left-3 backdrop-blur">
          {activeIndex + 1} / {items.length}
        </Badge>
      </div>

      {items.length > 1 && (
        <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto pb-1">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Show ${item.caption ?? `item ${index + 1}`}`}
              aria-current={index === activeIndex}
              className={cn(
                "relative size-20 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                index === activeIndex ? "border-primary" : "border-transparent hover:border-border",
              )}
            >
              {item.type === "IMAGE" || item.type === "FLOOR_PLAN" ? (
                <Image src={item.url} alt="" fill sizes="80px" className="object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center bg-foreground/85">
                  <Play className="size-4 text-background" aria-hidden />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-5xl p-2">
          <DialogTitle className="sr-only">{active.caption ?? title}</DialogTitle>
          <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
            {active.type === "IMAGE" || active.type === "FLOOR_PLAN" ? (
              <Image
                src={active.url}
                alt={active.alt ?? title}
                fill
                sizes="90vw"
                className="object-contain"
              />
            ) : active.type === "YOUTUBE" ? (
              <iframe
                src={toYouTubeEmbed(active.url)}
                title={active.caption ?? "Property video"}
                allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
                className="size-full"
              />
            ) : active.type === "VIDEO" ? (
              <video src={active.url} controls playsInline className="size-full" />
            ) : isEmbeddable(active.url) ? (
              <iframe
                src={active.url}
                title={active.caption ?? "Virtual tour"}
                allowFullScreen
                className="size-full"
              />
            ) : (
              // Not an allowlisted host, so the browser would refuse the frame
              // and show "This content is blocked" with no way through. Offer
              // the tour where it actually lives instead.
              <div className="flex size-full flex-col items-center justify-center gap-4 bg-muted p-8 text-center">
                <ExternalLink className="size-8 text-muted-foreground" aria-hidden />
                <div>
                  <p className="font-medium">This tour opens on the provider&apos;s site</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    It is hosted somewhere this page cannot embed safely.
                  </p>
                </div>
                <Button asChild>
                  <a href={active.url} target="_blank" rel="noopener noreferrer">
                    Open the virtual tour
                    <ExternalLink aria-hidden />
                  </a>
                </Button>
              </div>
            )}
          </div>
          {active.caption && (
            <p className="px-2 pb-1 text-sm text-muted-foreground">{active.caption}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Accept a watch URL, a share URL or an id and return a privacy-friendly embed. */
function toYouTubeEmbed(url: string): string {
  const match = /(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{6,})/.exec(url);
  const id = match?.[1] ?? url;
  return `https://www.youtube-nocookie.com/embed/${id}`;
}
