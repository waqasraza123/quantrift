import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { getProductConfig } from "@/config/product";
import "./globals.css";

const product = getProductConfig();

export const metadata: Metadata = {
  metadataBase: new URL(product.siteUrl),
  title: {
    default: product.name,
    template: `%s · ${product.name}`,
  },
  description: product.description,
  applicationName: product.name,
  keywords: [
    "QuantRift",
    "agentic AI",
    "AI agents",
    "quantitative finance",
    "market intelligence",
    "signal analysis",
    "evidence-based research",
    "FastAPI",
    "Next.js",
  ],
  authors: [{ name: "Waqas Raza" }],
  creator: "Waqas Raza",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: product.name,
    description: product.description,
    siteName: product.name,
    images: [{ url: "/quantrift-evidence.png", width: 1672, height: 941, alt: "QuantRift evidence-based market intelligence" }],
  },
  twitter: {
    card: "summary_large_image",
    title: product.name,
    description: product.description,
    images: ["/quantrift-evidence.png"],
  },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: "#061416",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
