import type { Metadata } from "next";
import "./globals.css";
import { ThemeToggle } from "../components/ui/ThemeToggle";

export const metadata: Metadata = {
  title: "Formation – Écritures de clôture",
  description: "Application pédagogique interactive",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className="bg-background text-foreground transition-colors duration-300">
        <header className="flex items-center justify-between p-4 border-b border-border">
          <h1 className="font-semibold text-lg">Formation – Écritures de clôture</h1>
          <ThemeToggle />
        </header>
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}