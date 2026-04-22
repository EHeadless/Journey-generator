import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Journey Generator | Behavioral Strategy Engine",
  description: "Generate journey phases, demand spaces, and activation outputs for client engagements",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body
        className={`${inter.className} min-h-full`}
        style={{ background: 'var(--bg-0)', color: 'var(--fg-1)' }}
      >
        {children}
      </body>
    </html>
  );
}
