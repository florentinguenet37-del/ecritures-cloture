// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Formation – Écritures de clôture",
  description: "App pédagogique interactive (FNP, CCA, FAE, etc.)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="dark">
      <body className="bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
