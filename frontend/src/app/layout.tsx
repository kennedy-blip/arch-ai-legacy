import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Archaeo-Code | Legacy Infrastructure & Code Archeology Platform",
  description: "Enterprise platform for reverse-engineering legacy codebases without breaking production. Polyglot ASTs, Neo4j Knowledge Graph, and Grounded AI Chat.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-archaeo-bg text-slate-100 antialiased selection:bg-archaeo-gold selection:text-black">
        {children}
      </body>
    </html>
  );
}
