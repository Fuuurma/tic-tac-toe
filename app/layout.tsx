import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/menu/themeProvider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdProvider } from "@/components/common/adProvider";
import { PWAWrapper } from "@/components/common/pwaWrapper";
import { ClientSidebarWrapper } from "@/components/common/clientSidebarWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tic Tac Toe - Play Online vs AI or Friends",
  description: "Play Tic Tac Toe against AI or friends online. Multiple difficulty levels available. Free to play!",
  keywords: ["Tic Tac Toe", "game", "online", "AI", "multiplayer"],
  authors: [{ name: "Tic Tac Toe" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tic Tac Toe",
  },
  icons: {
    icon: [
      { url: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    title: "Tic Tac Toe - Play Online vs AI or Friends",
    description: "Play Tic Tac Toe against AI or friends online. Multiple difficulty levels available. Free to play!",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

const adClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || "";
const adSlot = process.env.NEXT_PUBLIC_ADSENSE_BANNER_SLOT || "";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"
          crossOrigin="anonymous"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PWAWrapper>
          <ClientSidebarWrapper>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <AdProvider adClient={adClient}>
                {children}
              </AdProvider>
            </ThemeProvider>
          </ClientSidebarWrapper>
        </PWAWrapper>
      </body>
    </html>
  );
}
