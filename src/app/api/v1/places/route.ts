import { z } from "zod";
import { withApi } from "@/lib/api/handler";
import { getLocalitiesForCity, searchProjects, type ProjectSummary } from "@/lib/data/places";
import { findCity } from "@/data/india";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/places?city=Noida
 *
 * The localities and projects inside a city, for the header's location picker.
 * It exists so the picker can drill down — city, then locality, then project —
 * without closing and reopening on a full page round trip.
 *
 * Public, and deliberately so: this is the same information any visitor can
 * read off the search page. It carries no personal data.
 */
const QuerySchema = z.object({
  city: z
    .string()
    .trim()
    .max(80)
    .transform((value) => findCity(value)?.name)
    .refine((value): value is string => Boolean(value), {
      message: "Not a city we recognise.",
    }),
});

interface PlacesResult {
  localities: string[];
  projects: ProjectSummary[];
}

export const GET = withApi<unknown, z.infer<typeof QuerySchema>, PlacesResult>(
  {
    querySchema: QuerySchema,
    rateLimit: { scope: "api:places", limit: 60, windowSeconds: 60 },
  },
  async ({ query }) => {
    const [localities, projects] = await Promise.all([
      getLocalitiesForCity(query.city),
      searchProjects(query.city, undefined, 60),
    ]);

    return { data: { localities, projects: [...projects] } };
  },
);
