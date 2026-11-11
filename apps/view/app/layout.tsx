import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { themeScript } from "./_components/layout/theme/theme-script";
import { BASE_URL } from "./_lib/consts";
import { AuthProvider } from "./_lib/auth";

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

/**
 * Lo común a los dos sitios. El título, la descripción, la imagen para
 * compartir y los datos de la empresa los pone app/[marca]/layout.tsx.
 */
export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  robots: {
    index: true,
    follow: true,
    "max-snippet": 160,
    "max-image-preview": "large",
  },
  // Sin `alternates.canonical` aca: lo heredaria cada pagina y todas se
  // declararian copia de la home. El canonical lo pone `metadataSeccion`.
  icons: {
    icon: "/favicon.ico",
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
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
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
          {/* La barra, el pie, el asistente y el aviso de cookies van con la
              marca de la página: los pone MarcaShell (app/[marca]/layout.tsx). */}
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
