"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly badge?: number;
  readonly section?: string;
}

/**
 * Sidebar navigation.
 *
 * A client component purely so the active item can be highlighted from the
 * pathname; everything it renders is static.
 */
export function DashboardNav({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();

  const sections = items.reduce<Map<string, NavItem[]>>((acc, item) => {
    const key = item.section ?? "";
    const list = acc.get(key) ?? [];
    list.push(item);
    acc.set(key, list);
    return acc;
  }, new Map());

  return (
    <nav className="space-y-5" aria-label="Dashboard">
      {[...sections.entries()].map(([section, sectionItems]) => (
        <div key={section || "default"}>
          {section && (
            <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {section}
            </p>
          )}
          <ul className="space-y-0.5">
            {sectionItems.map((item) => {
              // Exact match for index routes, prefix match for their children,
              // so /agent/properties/new still highlights "My listings".
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" &&
                  item.href !== "/admin" &&
                  pathname.startsWith(`${item.href}/`));

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <Badge variant={isActive ? "default" : "muted"} size="sm">
                        {item.badge > 99 ? "99+" : item.badge}
                      </Badge>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
