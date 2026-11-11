import type { ReactNode } from "react";
import Navbar from "./navbar/Navbar";
import Footer from "./footer/Footer";
import AsistenteWidget from "../asistente/AsistenteWidget";
import BannerCookies from "../legal/BannerCookies";
import { MarcaProvider } from "../../_lib/marca";
import { marcaPorSlug, type SlugMarca } from "../../_lib/company";

/**
 * Lo que rodea a cada página del sitio de una empresa: barra, pie y asistente,
 * con su marca. `data-brand` cambia los colores (globals.css). Lo usan el
 * layout de `app/[marca]` y la página 404.
 */
export default function MarcaShell({
  slug,
  children,
}: {
  slug: SlugMarca;
  children: ReactNode;
}) {
  return (
    <MarcaProvider slug={slug}>
      <div data-brand={slug} className="flex flex-1 flex-col">
        <Navbar marca={marcaPorSlug(slug)} />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
        <AsistenteWidget />
        {/* CU-76: sale solo si el navegador no tiene preferencia guardada. */}
        <BannerCookies />
      </div>
    </MarcaProvider>
  );
}
