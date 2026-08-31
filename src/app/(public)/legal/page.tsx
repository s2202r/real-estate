import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { appConfig, legalEntityDetails } from "@/config/app";
import { legalDocuments } from "@/content/legal";

export const metadata: Metadata = {
  title: "Legal",
  description: `The terms, policies and disclosures that govern the use of ${appConfig.name}.`,
  alternates: { canonical: `${appConfig.url}/legal` },
};

export default function LegalIndexPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-bold tracking-tight">Legal</h1>
      <p className="mt-3 text-lg text-muted-foreground">
        Everything that governs your use of {appConfig.name}, in one place. Each document says when
        it was last changed.
      </p>

      <div className="mt-10 space-y-3">
        {legalDocuments.map((document) => (
          <Link key={document.slug} href={`/${document.slug}`} className="block">
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-start gap-4 p-5">
                <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <p className="font-medium">{document.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{document.summary}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Updated{" "}
                    <time dateTime={document.updated}>
                      {new Date(document.updated).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </time>
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-10">
        <CardContent className="p-6 text-sm">
          <h2 className="font-semibold">Operating entity</h2>
          <dl className="mt-3 space-y-2 text-muted-foreground">
            <Row label="Company">{legalEntityDetails.name}</Row>
            {legalEntityDetails.registrationNumber && (
              <Row label="Registration">{legalEntityDetails.registrationNumber}</Row>
            )}
            {legalEntityDetails.gstin && <Row label="GSTIN">{legalEntityDetails.gstin}</Row>}
            {legalEntityDetails.registeredAddress && (
              <Row label="Registered office">{legalEntityDetails.registeredAddress}</Row>
            )}
            <Row label="Support">{appConfig.supportEmail}</Row>
            <Row label="Grievances">{legalEntityDetails.grievanceEmail}</Row>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-40 shrink-0 text-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
