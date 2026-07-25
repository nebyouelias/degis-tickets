import type { Metadata } from "next";
import { Manrope, Noto_Serif_Ethiopic } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const ethiopic = Noto_Serif_Ethiopic({
  subsets: ["ethiopic"],
  weight: ["500", "700"],
  variable: "--font-ethiopic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Degis Tickets — ድግስ",
  description:
    "The official home of Ethiopian events. Concerts, football, festivals, nightlife — verified tickets, delivered to your phone.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${ethiopic.variable}`}>
      <body className="bg-ink-950 font-sans text-ink-100 antialiased">
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}