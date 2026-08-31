import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { refundsDocument } from "@/content/legal";
import { appConfig } from "@/config/app";

export const metadata: Metadata = {
  title: refundsDocument.title,
  description: refundsDocument.summary,
  alternates: { canonical: `${appConfig.url}/refunds` },
};

export default function Page() {
  return <LegalPage document={refundsDocument} />;
}
