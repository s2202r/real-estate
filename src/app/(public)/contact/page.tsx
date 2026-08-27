import type { Metadata } from "next";
import { Mail, MessageSquare, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { appConfig } from "@/config/app";

export const metadata: Metadata = {
  title: "Contact",
  description: `Get in touch with the ${appConfig.name} team.`,
  alternates: { canonical: `${appConfig.url}/contact` },
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-bold tracking-tight">Contact us</h1>
      <p className="mt-4 text-muted-foreground">
        We reply to every message. For anything touching a live transaction, include the reference
        code shown on the deal or visit so we can find it immediately.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <Mail className="size-5 text-primary" aria-hidden />
            <h2 className="mt-3 font-semibold">General enquiries</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              <a
                href={`mailto:${appConfig.supportEmail}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {appConfig.supportEmail}
              </a>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <MessageSquare className="size-5 text-primary" aria-hidden />
            <h2 className="mt-3 font-semibold">Agents and partners</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Agent verification, inventory sharing and commission questions are handled from your
              agent dashboard, where they stay attached to the record.
            </p>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardContent className="p-6">
            <ShieldAlert className="size-5 text-destructive" aria-hidden />
            <h2 className="mt-3 font-semibold">Grievance officer</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              As required under the Consumer Protection (E-Commerce) Rules 2020 and the IT Rules
              2021, a grievance officer is appointed for this platform. Their name and contact
              details are published in the platform settings before launch.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
