"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Glyph } from "@/components/ui/Icon";
import { Logo } from "./Logo";
import { Sidebar } from "./Sidebar";
import styles from "./Shell.module.css";

const DESKTOP_QUERY = "(min-width: 900px)";

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const pathname = usePathname();

  const close = useCallback(() => setOpen(false), []);

  // Close the panel whenever the route changes.
  const [prevPath, setPrevPath] = useState(pathname);
  if (pathname !== prevPath) {
    setPrevPath(pathname);
    if (open) setOpen(false);
  }

  // Focus moves into the panel on open and back to the menu button on close.
  useEffect(() => {
    if (open) {
      closeButton.current?.focus();
    } else if (wasOpen.current) {
      menuButton.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  // Escape closes; growing to desktop width closes too.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onMq = () => {
      if (mq.matches) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
    };
  }, [open]);

  return (
    <div className={styles.shell}>
      <header className={styles.topbar} inert={open || undefined}>
        <Logo />
        <button
          ref={menuButton}
          type="button"
          className={styles.menuButton}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="sidebar"
          onClick={() => setOpen(true)}
        >
          <Glyph name="menu" size={22} strokeWidth={2.4} />
        </button>
      </header>

      <aside id="sidebar" className={styles.sidebar} data-open={open}>
        <button
          ref={closeButton}
          type="button"
          className={styles.closeButton}
          aria-label="Close menu"
          onClick={close}
        >
          <Glyph name="close" size={22} strokeWidth={2.4} />
        </button>
        <Sidebar onNavigate={close} />
      </aside>

      <main className={styles.main} inert={open || undefined}>
        <div className={styles.mainInner}>{children}</div>
      </main>
    </div>
  );
}
