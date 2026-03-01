import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Options Tracker",
  description: "Track options trading activity",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <nav className="border-b border-slate-700 bg-slate-900/50 px-6 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <Link href="/" className="text-xl font-semibold text-sky-400">
              Options Tracker
            </Link>
            <div className="flex gap-8">
              <Link href="/" className="text-slate-300 hover:text-white">
                Dashboard
              </Link>
              <Link href="/trades" className="text-slate-300 hover:text-white">
                Trades
              </Link>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
