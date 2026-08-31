import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { appConfig } from "@/config/app";

/**
 * The shape every policy document on this site takes.
 *
 * One renderer rather than eight hand-laid-out pages, because these documents
 * are amended piecemeal and forever: a change to one must not depend on
 * remembering how another was marked up. Content is data; this decides how a
 * legal document reads.
 */
export interface LegalSection {
  readonly id: string;
  readonly heading: string;
  /** Paragraphs, lists and definition blocks, in the order they appear. */
  readonly body: readonly LegalBlock[];
}

export type LegalBlock =
  | { readonly kind: "p"; readonly text: string }
  | { readonly kind: "list"; readonly items: readonly string[] }
  | { readonly kind: "numbered"; readonly items: readonly string[] }
  | { readonly kind: "definitions"; readonly items: readonly { term: string; text: string }[] }
  | { readonly kind: "callout"; readonly title?: string; readonly text: string };

export interface LegalDocument {
  readonly slug: string;
  readonly title: string;
  /** One line under the title, describing what the document is for. */
  readonly summary: string;
  /** ISO date. Shown prominently: a policy without a date is not a policy. */
  readonly updated: string;
  readonly sections: readonly LegalSection[];
}

export function LegalPage({ document }: { document: LegalDocument }) {
  const updated = new Date(document.updated).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
      <p className="text-sm font-medium text-muted-foreground">
        <Link href="/legal" className="underline-offset-4 hover:underline">
          Legal
        </Link>
      </p>

      <h1 className="mt-2 text-4xl font-bold tracking-tight">{document.title}</h1>
      <p className="mt-3 text-lg text-muted-foreground">{document.summary}</p>
      <p className="mt-4 text-sm text-muted-foreground">
        Last updated <time dateTime={document.updated}>{updated}</time> · Applies to{" "}
        {appConfig.name}, operated by {appConfig.legalEntity}.
      </p>

      {/* Long documents are unnavigable without one, and the sections people
          actually come for — cancellation, data deletion, how to complain —
          are never the ones at the top. */}
      {document.sections.length > 3 && (
        <nav aria-label="On this page" className="mt-8 rounded-lg border bg-muted/30 p-4">
          <h2 className="text-sm font-semibold">On this page</h2>
          <ol className="mt-2 space-y-1 text-sm">
            {document.sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {index + 1}. {section.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="mt-10 space-y-10">
        {document.sections.map((section, index) => (
          <section key={section.id} id={section.id} className="scroll-mt-20">
            <h2 className="text-xl font-semibold tracking-tight">
              <span className="mr-2 text-muted-foreground">{index + 1}.</span>
              {section.heading}
            </h2>
            <div className="mt-3 space-y-4 text-sm leading-relaxed text-muted-foreground">
              {section.body.map((block, blockIndex) => (
                <Block key={blockIndex} block={block} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "p":
      return <p>{block.text}</p>;

    case "list":
      return (
        <ul className="space-y-2 pl-1">
          {block.items.map((item, index) => (
            <li key={index} className="flex gap-2">
              <span aria-hidden className="select-none">
                ·
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );

    case "numbered":
      return (
        <ol className="list-decimal space-y-2 pl-5">
          {block.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ol>
      );

    case "definitions":
      return (
        <dl className="space-y-3">
          {block.items.map((item) => (
            <div key={item.term}>
              <dt className="font-medium text-foreground">{item.term}</dt>
              <dd className="mt-0.5">{item.text}</dd>
            </div>
          ))}
        </dl>
      );

    case "callout":
      return (
        <div className="flex gap-3 rounded-lg border border-warning/40 bg-warning-muted p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <div>
            {block.title && <p className="font-medium text-foreground">{block.title}</p>}
            <p className={block.title ? "mt-1" : undefined}>{block.text}</p>
          </div>
        </div>
      );
  }
}
