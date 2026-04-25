import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  title: "Bench OS — The AI Scientist",
  description:
    "From scientific hypothesis to runnable experiment plan. Real catalog numbers, real protocols, confidence-scored. An operating system for the lab.",
  openGraph: {
    title: "Bench OS — The AI Scientist",
    description: "From hypothesis to runnable experiment plan in minutes.",
    type: "website",
  },
};

// Hardcoded init script — restores theme + brightness from localStorage before
// React hydrates to prevent flash-of-unstyled-content. No user input crosses
// this boundary; the literal string is safe to inline.
const FOUC_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('bench-os:theme')||'light';var b=localStorage.getItem('bench-os:brightness')||'100';document.documentElement.setAttribute('data-theme',t);document.documentElement.style.setProperty('--display-brightness',(parseInt(b,10)/100).toString())}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: FOUC_INIT_SCRIPT }} />
      </head>
      <body className="h-full overflow-hidden">
        <a href="#desktop-content" className="skip-to-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
