import type { Metadata, Viewport } from "next";
import { Libre_Franklin } from "next/font/google";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";

const libreFranklin = Libre_Franklin({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nonet",
  description: "Play, review and train sudoku in your browser.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F4EFE4",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={libreFranklin.variable}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
