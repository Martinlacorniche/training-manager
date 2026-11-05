import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Une seule police pour tout le site, la même que l'app.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ngsportcoaching.com"),
  title: "C'est Ludique — NG Sport Coaching",
  description: "La plateforme de coaching sportif 100% gratuite pour les coachs et leurs athlètes.",
  alternates: { canonical: "/" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${jakarta.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
