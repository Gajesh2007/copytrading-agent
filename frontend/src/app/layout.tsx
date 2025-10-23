import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Toaster } from "@/components/ui/sonner";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";

const headingFont = Space_Mono({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const monoFont = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sigma Arena - AI Trading Agents",
  description: "Sigma Arena: Automated trading platform that mirrors top AI trading agents from Nof1.ai Alpha Arena on Hyperliquid. Real-time position tracking, risk management, and transparent performance metrics. Trade like DeepSeek V3.1, Qwen3 Max, and Grok 4 with configurable leverage and automated reconciliation.",
  keywords: [
    "Sigma Arena",
    "copy trading",
    "crypto trading bot",
    "AI trading",
    "Hyperliquid",
    "automated trading",
    "Nof1.ai",
    "Alpha Arena",
    "DeepSeek V3.1",
    "Qwen3 Max",
    "Grok 4",
    "algorithmic trading",
    "DeFi",
    "perpetual futures",
    "trading vaults",
    "AI agents",
  ],
  authors: [{ name: "Gajesh Naik" }],
  creator: "Gajesh Naik",
  publisher: "Gajesh Naik",
  openGraph: {
    title: "Sigma Arena - AI Trading Agents",
    description: "Automated trading platform mirroring top AI agents from Nof1.ai Alpha Arena. Real-time tracking, risk controls, and transparent metrics on Hyperliquid.",
    type: "website",
    locale: "en_US",
    siteName: "Sigma Arena",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sigma Arena - AI Trading Agents",
    description: "Mirror top AI trading agents from Nof1.ai on Hyperliquid. DeepSeek V3.1, Qwen3 Max, Grok 4 with automated risk management.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add your verification codes if needed
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-J361SEM7KY"
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-J361SEM7KY');
          `}
        </Script>
      </head>
      <body className={`${headingFont.variable} ${monoFont.variable} antialiased`}>
        <ThemeProvider>
          <div className="flex min-h-screen flex-col">
            <div className="flex-1 px-4 pt-3 sm:px-10 sm:pt-4">
              <Header />
              <main className="mt-6">{children}</main>
            </div>
            <Footer />
          </div>
          <Toaster richColors position="top-right" />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
