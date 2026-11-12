import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { Providers } from "@/components/providers/Providers";

export const metadata: Metadata = {
  title: {
    default: "MNI POS – Smart POS & Stock Management",
    template: "%s – MNI POS",
  },
  description:
    "MNI POS is a point-of-sale and stock management SaaS for businesses worldwide. Sell faster, track inventory, print invoices, and manage your team from one secure platform.",
  applicationName: "MNI POS",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
    { media: "(prefers-color-scheme: dark)", color: "#080808" },
  ],
};

/**
 * Runs before first paint. Light (orange & white) is default. Stored: light | dark.
 */
const themeScript = `(function(){try{var s=localStorage.getItem('omnipos-theme');var dark=(s==='dark');var root=document.documentElement;root.classList.remove('dark','theme-light');if(dark)root.classList.add('dark');root.style.colorScheme=dark?'dark':'light';if(s==='brand'||s==='default'||s==='theme-light')localStorage.setItem('omnipos-theme','light');}catch(e){document.documentElement.classList.remove('dark','theme-light');}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
