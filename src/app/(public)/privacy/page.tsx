import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { privacyDocument } from "@/content/legal";
import { appConfig } from "@/config/app";

export const metadata: Metadata = {
  title: privacyDocument.title,
  description: privacyDocument.summary,
  alternates: { canonical: `${appConfig.url}/privacy` },
};

export default function Page() {
  return <LegalPage document={privacyDocument} />;
}
