import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Playfair_Display, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";
import { ThemeScript } from "@/components/theme/theme-provider";

// UI type: geometric, tight, excellent lining numerals for the calendar
const sans = Plus_Jakarta_Sans({
  variable: "--font-sans-app",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

// Display type: reserved for the brand and large page titles
const display = Playfair_Display({
  variable: "--font-display-app",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700"],
});

const mono = Geist_Mono({
  variable: "--font-mono-app",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Amado Blends — Panel administrativo",
  description: "Panel administrativo para la barbería Amado Blends",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Amado Blends",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0b" },
    { media: "(prefers-color-scheme: light)", color: "#f4f4f5" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      // data-theme is set by ThemeScript before paint to avoid a flash
      data-theme="dark"
      className={`${sans.variable} ${display.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript fallback="dark" />
      </head>
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        <div className="app-shell flex flex-col">{children}</div>
      </body>
    </html>
  );
}
