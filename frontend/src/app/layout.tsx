import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/lib/providers";

export const metadata: Metadata = {
  title: {
    default: "Salemate | AI-Powered Social Commerce Platform",
    template: "%s | Salemate"
  },
  description: "Automate your sales, inventory, and customer outreach on Facebook & Instagram with the power of AI.",
  keywords: ["AI CRM", "Social Commerce", "Messenger Automation", "Vietnamese SME", "SaaS"],
  authors: [{ name: "Salemate Team" }],
  icons: {
    icon: "/favicon.ico",
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FF5733"
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="scroll-smooth">
      <body className="min-h-screen selection:bg-accent-soft selection:text-accent">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
