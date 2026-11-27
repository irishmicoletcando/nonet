"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Icon, type IconName, type Tint } from "@/components/ui/Icon";
import { Pill } from "@/components/ui/Pill";
import { Logo } from "./Logo";
import { StreakLine } from "./StreakLine";
import styles from "./Shell.module.css";

type NavKey = "daily" | "quick" | "review" | "train" | "courses" | "solver" | "scan" | "pricing";

interface NavItem {
  key: NavKey;
  label: string;
  icon: IconName;
  tint: Tint;
  href?: string; // no href = SOON, not a link
}

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "PLAY",
    items: [
      { key: "daily", label: "Daily puzzle", icon: "calendar", tint: "yellow", href: "/play?daily=1" },
      { key: "quick", label: "Quick game", icon: "play", tint: "mint", href: "/play" },
    ],
  },
  {
    label: "REVIEW",
    items: [{ key: "review", label: "Review a puzzle", icon: "review", tint: "lavender", href: "/review" }],
  },
  {
    label: "TRAIN",
    items: [
      { key: "train", label: "Technique trainer", icon: "train", tint: "pink", href: "/train" },
      { key: "courses", label: "Courses", icon: "courses", tint: "blue" },
    ],
  },
  {
    label: "TOOLS",
    items: [
      { key: "solver", label: "Solver", icon: "solver", tint: "yellow", href: "/review" },
      { key: "scan", label: "Scan a puzzle", icon: "scan", tint: "mint" },
    ],
  },
  {
    label: "ACCOUNT",
    items: [{ key: "pricing", label: "Pricing", icon: "pricing", tint: "yellow", href: "/pricing" }],
  },
];

/** `daily` is undefined while search params are not yet known (prerender). */
function activeKey(pathname: string, daily: string | null | undefined): NavKey | null {
  if (pathname === "/play") {
    if (daily === undefined) return null;
    return daily === "1" ? "daily" : "quick";
  }
  if (pathname === "/review") return "review"; // Solver also links here but never shows as active
  if (pathname === "/train") return "train";
  if (pathname === "/pricing") return "pricing";
  return null;
}

function NavList({ daily, onNavigate }: { daily: string | null | undefined; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = activeKey(pathname, daily);

  return (
    <div className={styles.groups}>
      {GROUPS.map((g) => (
        <div key={g.label} className={styles.group}>
          <p className={styles.groupLabel} id={`nav-${g.label}`}>
            {g.label}
          </p>
          <ul aria-labelledby={`nav-${g.label}`}>
            {g.items.map((item) => (
              <li key={item.key}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className={styles.navItem}
                    aria-current={active === item.key ? "page" : undefined}
                    onClick={onNavigate}
                  >
                    <Icon name={item.icon} tint={item.tint} />
                    <span>{item.label}</span>
                  </Link>
                ) : (
                  <span className={styles.navItem} aria-disabled="true">
                    <Icon name={item.icon} tint={item.tint} />
                    <span>{item.label}</span>
                    <span className={styles.navPill}>
                      <Pill tone="muted">SOON</Pill>
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function NavWithParams({ onNavigate }: { onNavigate?: () => void }) {
  const params = useSearchParams();
  return <NavList daily={params.get("daily")} onNavigate={onNavigate} />;
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className={styles.sidebarLogo}>
        <Logo onNavigate={onNavigate} />
      </div>
      <StreakLine />
      <nav aria-label="Main">
        <Suspense fallback={<NavList daily={undefined} onNavigate={onNavigate} />}>
          <NavWithParams onNavigate={onNavigate} />
        </Suspense>
      </nav>
      <p className={styles.footer}>Free plan available. Runs in your browser.</p>
    </>
  );
}
