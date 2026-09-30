import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import Navigation from "@/components/Navigation";
import AppShell from "@/components/AppShell";

const barlowCondensed = Barlow_Condensed({
  variable: "--font-sport",
  weight: ["500", "600", "700", "800", "900"],
  subsets: ["latin"],
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Strivo — Play. Compete. Rise.", template: "%s | Strivo" },
  applicationName: "Strivo",
  description: "Your badminton arena. Follow tournaments, track live scores, and climb the Elo leaderboard with Strivo.",
  manifest: "/manifest.json",
  icons: { apple: "/strivo-icon-192.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Strivo",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0B1020",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${barlowCondensed.variable} ${plusJakartaSans.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-[var(--bg-ink)] text-[var(--text-main)] font-[var(--font-body)] bg-court-texture selection:bg-[var(--accent-lime)] selection:text-[#0B1020]">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <ThemeProvider>
          <AuthProvider>
            <Navigation />
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
