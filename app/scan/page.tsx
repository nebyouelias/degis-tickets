import type { Metadata } from "next";
import { ScannerApp } from "@/components/scanner/ScannerApp";
import { RegisterServiceWorker } from "@/components/scanner/RegisterServiceWorker";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Degis Scanner",
  description: "Offline-capable door scanner for Degis Tickets.",
};

export default function ScanPage() {
  return (
    <>
      <RegisterServiceWorker />
      <ScannerApp />
    </>
  );
}
