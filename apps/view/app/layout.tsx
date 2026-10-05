import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import Navbar from "./_components/layout/navbar/Navbar";
import Footer from "./_components/layout/footer/Footer";
import AsistenteWidget from "./_components/asistente/AsistenteWidget";
import BannerCookies from "./_components/legal/BannerCookies";
import { themeScript } from "./_components/layout/theme/theme-script";
import { BASE_URL } from "./_lib/consts";
import {
  COMPANY_ADDRESS,
  COMPANY_BRAND,
  COMPANY_LEGAL_NAME,
  COMPANY_PHONE_DISPLAY,
} from "./_lib/company";
import { AuthProvider } from "./_lib/auth";
import { BASE_SHARE_METADATA, SEO_DEFAULTS } from "./_lib/seo";

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    template: "%s | Finet — Fibra Optica en La Pintana",
    default: SEO_DEFAULTS.title,
  },
  description: SEO_DEFAULTS.description,
  keywords: [
    "internet fibra optica",
    "La Pintana",
    "Puente Alto",
    "TV digital",
    "planes internet hogar",
    "fibra optica sur de Santiago",
    "Finet",
  ],
  authors: [{ name: COMPANY_LEGAL_NAME }],
  creator: COMPANY_LEGAL_NAME,
  publisher: COMPANY_LEGAL_NAME,
  robots: {
    index: true,
    follow: true,
    "max-snippet": 160,
    "max-image-preview": "large",
  },
  // Sin `alternates.canonical` aca: lo heredaria cada pagina y todas se
  // declararian copia de la home. El canonical lo pone `metadataSeccion`.
  ...BASE_SHARE_METADATA,
  icons: {
    icon: "/favicon.ico",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: COMPANY_LEGAL_NAME,
  alternateName: COMPANY_BRAND,
  url: BASE_URL,
  logo: `${BASE_URL}/brand/FinetLogo.png`,
  contactPoint: {
    "@type": "ContactPoint",
    telephone: COMPANY_PHONE_DISPLAY,
    contactType: "customer service",
    areaServed: [COMPANY_ADDRESS.country],
    availableLanguage: ["Spanish"],
  },
  areaServed: {
    "@type": "City",
    name: COMPANY_ADDRESS.locality,
  },
  address: {
    "@type": "PostalAddress",
    addressLocality: COMPANY_ADDRESS.locality,
    addressRegion: COMPANY_ADDRESS.region,
    addressCountry: COMPANY_ADDRESS.country,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${hanken.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <meta name="apple-mobile-web-app-title" content="Finet" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {/* Skip-to-content link for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-100 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-background focus:text-sm focus:outline-none"
        >
          Saltar al contenido principal
        </a>
        <AuthProvider>
          <Navbar />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
          <AsistenteWidget />
          {/* CU-76: sale solo si el navegador no tiene preferencia guardada. */}
          <BannerCookies />
        </AuthProvider>
      </body>
    </html>
  );
}
