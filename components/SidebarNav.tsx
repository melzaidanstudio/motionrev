"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavIcon = "home" | "talking-head" | "bedah" | "brand" | "kredit" | "settings" | "help" | "admin";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  /** Extra paths that count as this item, e.g. analysis detail pages under "Bedah Video". */
  also?: string[];
  badge?: string;
}

function isActive(path: string, item: NavItem): boolean {
  const match = (p: string) => (p === "/" ? path === "/" : path === p || path.startsWith(`${p}/`));
  return match(item.href) || (item.also ?? []).some(match);
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Menu groups; the current page is marked with aria-current and the amber edge. On a phone, one scrolling row. */
export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  return (
    <div className="flex gap-1 overflow-x-auto md:flex-col md:gap-5 md:overflow-visible">
      {groups.map((g) => (
        <div key={g.label} className="flex md:block">
          <p className="mb-1 hidden px-3 text-xs text-muted md:block">{g.label}</p>
          <Links items={g.items} />
        </div>
      ))}
    </div>
  );
}

function Links({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <ul className="flex gap-1 md:flex-col">
      {items.map((item) => {
        const active = isActive(path, item);
        return (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 border-l-2 px-3 text-sm no-underline ${
                active
                  ? "border-accent bg-panel-2 font-medium text-fg"
                  : "border-transparent text-muted hover:bg-panel-2 hover:text-fg"
              }`}
            >
              <Icon name={item.icon} />
              <span className="whitespace-nowrap">{item.label}</span>
              {item.badge !== undefined && <span className="ml-auto pl-2 font-mono text-xs text-fg">{item.badge}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Icon({ name }: { name: NavIcon }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: "shrink-0",
  };
  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" />
        </svg>
      );
    case "brand":
      // A palette.
      return (
        <svg {...common}>
          <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-1.2-1-1.6-1-2.6 0-.9.7-1.6 1.6-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3Z" />
          <circle cx="7.5" cy="11" r="1.2" />
          <circle cx="10" cy="7" r="1.2" />
          <circle cx="15" cy="7.5" r="1.2" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
        </svg>
      );
    case "help":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" />
        </svg>
      );
    case "talking-head":
      // A person framed in a vertical 9:16 screen.
      return (
        <svg {...common}>
          <rect x="6" y="2.5" width="12" height="19" rx="1.5" />
          <circle cx="12" cy="10" r="2.6" />
          <path d="M8 18c.8-2.2 2.2-3.2 4-3.2s3.2 1 4 3.2" />
        </svg>
      );
    case "bedah":
      // A filmstrip with a cut line.
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="1" />
          <path d="M7 5v14M17 5v14M12 3v18" strokeDasharray="2 2" />
        </svg>
      );
    case "kredit":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="7" rx="7" ry="3" />
          <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
        </svg>
      );
    case "admin":
      return (
        <svg {...common}>
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        </svg>
      );
  }
}
