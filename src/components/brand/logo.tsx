import { cn } from "@/lib/utils";
import { appConfig } from "@/config/app";

/**
 * Brand mark and lockup.
 *
 * The MARK is a fixed asset: a rounded tile carrying a floating chevron roof
 * over an arch portal. The portal is the point — it makes the *space* the
 * subject rather than the building around it, and it keeps the glyph from
 * reading as a stock house icon.
 *
 * The WORDMARK renders `appConfig.name` as text rather than baked-in
 * lettering, so the product stays rebrandable from `NEXT_PUBLIC_APP_NAME`
 * exactly like the rest of the codebase. Renaming never orphans a hard-coded
 * SVG.
 *
 * Colours are the design-system primary converted from OKLCH to sRGB. SVG in a
 * favicon context cannot read CSS custom properties, so they are literal here
 * by necessity; `scripts/brand-colors.py` regenerates them if the palette moves.
 *
 * The tile is painted with a flat fill, deliberately: a gradient needs a
 * `<defs>` id, and any page rendering the mark twice (header + footer, or a
 * responsive pair) would emit that id twice. `url(#id)` binds to whichever
 * comes first in the document — and when that copy sits inside a `hidden`
 * subtree, the visible mark paints nothing. A flat fill cannot collide, and at
 * the sizes this renders (16–32px) the gradient was imperceptible anyway.
 */

export const BRAND_COLORS = {
  /** The tile. Used by the UI mark, the favicon and the generated icons alike. */
  solid: "#115664",
  glyph: "#FFFFFF",
} as const;

/** Shared so the favicon, apple icon and OG image cannot drift from the UI. */
export const LOGO_PATHS = {
  roof: "M16 3.9a2 2 0 0 1 1.25.44l10.35 8.42a1.95 1.95 0 0 1-2.46 3.03L16 8.3 6.86 15.79a1.95 1.95 0 0 1-2.46-3.03l10.35-8.42A2 2 0 0 1 16 3.9Z",
  body: "M7.6 16.9h16.8a1.7 1.7 0 0 1 1.7 1.7v6.7a2.7 2.7 0 0 1-2.7 2.7H8.6a2.7 2.7 0 0 1-2.7-2.7v-6.7a1.7 1.7 0 0 1 1.7-1.7Zm8.4 2.9a3.6 3.6 0 0 0-3.6 3.6V28h7.2v-4.6a3.6 3.6 0 0 0-3.6-3.6Z",
} as const;

export function LogoMark({
  className,
  size = 32,
  /** Render the tile in currentColor rather than the brand colour. */
  monochrome = false,
  title,
}: {
  className?: string;
  size?: number;
  monochrome?: boolean;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={className}
    >
      <rect
        width="32"
        height="32"
        rx="7.5"
        fill={monochrome ? "currentColor" : BRAND_COLORS.solid}
      />
      <path d={LOGO_PATHS.roof} fill={BRAND_COLORS.glyph} />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d={LOGO_PATHS.body}
        fill={BRAND_COLORS.glyph}
      />
    </svg>
  );
}

/**
 * Mark plus wordmark. The wordmark is hidden on very small screens by default
 * so the header never wraps; the mark alone still identifies the product.
 */
export function Logo({
  className,
  size = 32,
  showWordmark = true,
  wordmarkClassName,
}: {
  className?: string;
  size?: number;
  showWordmark?: boolean;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={size} title={showWordmark ? undefined : appConfig.name} />
      {showWordmark && (
        <span className={cn("font-semibold tracking-tight", wordmarkClassName)}>
          {appConfig.name}
        </span>
      )}
    </span>
  );
}
