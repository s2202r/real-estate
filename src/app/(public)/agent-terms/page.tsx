import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { agentTermsDocument } from "@/content/legal";
import { appConfig } from "@/config/app";

export const metadata: Metadata = {
  title: agentTermsDocument.title,
  description: agentTermsDocument.summary,
  alternates: { canonical: `${appConfig.url}/agent-terms` },
};

export default function Page() {
  return <LegalPage document={agentTermsDocument} />;
}
