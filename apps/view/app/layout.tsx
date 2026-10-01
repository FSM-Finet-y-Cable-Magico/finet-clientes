import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import Navbar from "./_components/layout/navbar/Navbar";
import Footer from "./_components/layout/footer/Footer";
import AsistenteWidget from "./_components/asistente/AsistenteWidget";
import { themeScript } from "./_components/layout/theme/theme-script";
import { BASE_URL } from "./_lib/consts";
import {
  COMPANY_ADDRESS,
  COMPANY_BRAND,
  COMPANY_LEGAL_NAME,
  COMPANY_PHONE_DISPLAY,
} from "./_lib/company";
import { AuthProvider } from "./_lib/auth";

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    template: "%s | Finet — Fibra Optica en La Pintana",
    default:
      "Finet — Internet Fibra Optica y TV Digital | La Pintana, Puente Alto",
  },
  description:
    "Internet de fibra optica de alta velocidad desde 200 Mbps simetricos. Planes hogar y empresa en La Pintana, Puente Alto, La Florida y La Granja. Contrata en linea.",
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
  openGraph: {
    type: "website",
    siteName: "Finet",
    title: "Finet — Internet Fibra Optica y TV Digital",
    description:
      "Internet de fibra optica de alta velocidad desde 200 Mbps simetricos. Planes para hogar y empresa en La Pintana y Puente Alto.",
    url: BASE_URL,
    locale: "es_CL",
  },
  twitter: {
    card: "summary_large_image",
    title: "Finet — Internet Fibra Optica y TV Digital",
    description:
      "Internet de fibra optica de alta velocidad desde 200 Mbps simetricos en La Pintana y Puente Alto.",
  },
  alternates: {
    canonical: BASE_URL,
  },
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
        </AuthProvider>
      </body>
    </html>
  );
}
