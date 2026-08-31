import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { disclaimerDocument } from "@/content/legal";
import { appConfig } from "@/config/app";

export const metadata: Metadata = {
  title: disclaimerDocument.title,
  description: disclaimerDocument.summary,
  alternates: { canonical: `${appConfig.url}/disclaimer` },
};

export default function Page() {
  return <LegalPage document={disclaimerDocument} />;
}
