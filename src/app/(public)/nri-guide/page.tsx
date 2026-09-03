import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage } from "@/components/legal/legal-page";
import { nriGuideDocument } from "@/content/legal";
import { appConfig } from "@/config/app";
import { features } from "@/config/features";

export const metadata: Metadata = {
  title: nriGuideDocument.title,
  description: nriGuideDocument.summary,
  alternates: { canonical: `${appConfig.url}/nri-guide` },
};

export default function NriGuidePage() {
  // Part of NRI mode: with the module off there is no second currency, no
  // dual-clock visit time and nothing for the page to describe.
  if (!features.ENABLE_NRI_MODE) notFound();
  return <LegalPage document={nriGuideDocument} />;
}
