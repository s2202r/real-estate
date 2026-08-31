import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { termsDocument } from "@/content/legal";
import { appConfig } from "@/config/app";

export const metadata: Metadata = {
  title: termsDocument.title,
  description: termsDocument.summary,
  alternates: { canonical: `${appConfig.url}/terms` },
};

export default function Page() {
  return <LegalPage document={termsDocument} />;
}
