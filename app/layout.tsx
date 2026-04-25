import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono, Fraunces } from "next/font/google";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

// Body — Geist (Vercel's geometric grotesque). Replaces Inter; better
// proportions for technical UI at small sizes.
const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// Display — Fraunces (variable serif). Used selectively for marquee
// headings: boot screen, app titles, section headers.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

// Mono — JetBrains Mono. Replaces Geist Mono. Larger x-height + more
// open digit shapes for catalog numbers and code blocks.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  title: "Aliquot — The AI Scientist",
  description:
    "From scientific hypothesis to runnable experiment plan. Real catalog numbers, real protocols, confidence-scored. An operating system for the lab.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "Aliquot — The AI Scientist",
    description: "From hypothesis to runnable experiment plan in minutes.",
    type: "website",
    images: ["/icon.svg"],
  },
};

// Hardcoded init script — restores theme + accent + brightness from
// localStorage before React hydrates to prevent flash-of-unstyled-content.
// useLocalStorage stores values JSON-stringified, so quotes are stripped.
// No user input crosses this boundary; the literal string is safe to inline.
const FOUC_INIT_SCRIPT = `(function(){try{var s=function(k,d){var v=localStorage.getItem(k);if(v==null)return d;return v.replace(/^"|"$/g,'');};var t=s('aliquot:theme','light');var a=s('aliquot:accent','blue');var b=s('aliquot:brightness','100');var d=document.documentElement;d.setAttribute('data-theme',t);d.setAttribute('data-accent',a);d.style.setProperty('--display-brightness',(parseInt(b,10)/100).toString())}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      data-accent="blue"
      suppressHydrationWarning
      className={`${geist.variable} ${jetbrainsMono.variable} ${fraunces.variable} h-full antialiased`}
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
