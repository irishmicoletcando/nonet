import Link from "next/link";
import { Glyph } from "@/components/ui/Icon";
import styles from "./Shell.module.css";

export function Logo({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link href="/" className={styles.logo} onClick={onNavigate} aria-label="Nonet home">
      <span className={styles.logoMark} aria-hidden="true">
        <Glyph name="grid" size={19} strokeWidth={2.4} />
      </span>
      <span className={styles.logoWord}>Nonet</span>
    </Link>
  );
}
