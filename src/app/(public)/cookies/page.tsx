import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { cookiesDocument } from "@/content/legal";
import { appConfig } from "@/config/app";

export const metadata: Metadata = {
  title: cookiesDocument.title,
  description: cookiesDocument.summary,
  alternates: { canonical: `${appConfig.url}/cookies` },
};

export default function Page() {
  return <LegalPage document={cookiesDocument} />;
}
