import type { Metadata, Viewport } from "next";
import { cfg } from "@/lib/config";
import SwRegister from "./components/SwRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: cfg.appName,
  description: "Recovery, strain, sleep and everything on today's plate.",
  applicationName: cfg.appName,
  appleWebApp: { capable: true, title: cfg.appName, statusBarStyle: "black-translucent" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0b0d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
