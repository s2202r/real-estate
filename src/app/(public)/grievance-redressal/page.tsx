import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { grievanceDocument } from "@/content/legal";
import { appConfig } from "@/config/app";

export const metadata: Metadata = {
  title: grievanceDocument.title,
  description: grievanceDocument.summary,
  alternates: { canonical: `${appConfig.url}/grievance-redressal` },
};

export default function Page() {
  return <LegalPage document={grievanceDocument} />;
}
