import type { PlanBackend } from "./api";
import { BASE_URL } from "./consts";
import { MARCA_POR_DEFECTO, rutaMarca, type Marca } from "./company";

type BreadcrumbItem = { name: string; url: string };

/**
 * JSON para un `<script type="application/ld+json">`. Los nombres de los planes
 * vienen de la base: se escapa `<` para que ninguno pueda cerrar la etiqueta
 * (`</script>`) e inyectar HTML. `<` sigue siendo `<` al leer el JSON.
 */
function serializar(dato: unknown): string {
  return JSON.stringify(dato).replace(/</g, "\\u003c");
}

/** La URL absoluta de una ruta del sitio de la empresa. */
export function urlDelSitio(marca: Marca, ruta: `/${string}`): string {
  return ruta === "/" && !marca.prefijo
    ? BASE_URL
    : `${BASE_URL}${rutaMarca(marca, ruta)}`;
}

/** La empresa del sitio (antes en el layout raíz, solo de Finet). */
export function organizacionJsonLd(marca: Marca) {
  return serializar({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: marca.razonSocial,
    alternateName: marca.nombre,
    url: urlDelSitio(marca, "/"),
    logo: `${BASE_URL}${marca.logo.png}`,
    ...(marca.rut ? { taxID: marca.rut } : {}),
    contactPoint: {
      "@type": "ContactPoint",
      telephone: marca.telefono.display,
      contactType: "customer service",
      areaServed: [marca.direccion.pais],
      availableLanguage: ["Spanish"],
    },
    areaServed: marca.comunas.map((comuna) => ({ "@type": "City", name: comuna })),
    address: {
      "@type": "PostalAddress",
      ...(marca.direccion.calle ? { streetAddress: marca.direccion.calle } : {}),
      addressLocality: marca.direccion.comuna,
      addressRegion: marca.direccion.region,
      addressCountry: marca.direccion.pais,
    },
  });
}

export function productJsonLd(plan: PlanBackend, marca: Marca = MARCA_POR_DEFECTO) {
  return serializar({
    "@context": "https://schema.org",
    "@type": "Product",
    name: plan.nombre_comercial,
    description: plan.descripcion ?? undefined,
    brand: {
      "@type": "Brand",
      name: marca.nombre,
    },
    offers: {
      "@type": "Offer",
      price: String(plan.precio_mensual),
      priceCurrency: "CLP",
      availability: "https://schema.org/InStock",
      url: urlDelSitio(marca, `/contratar/${plan.id_plan}`),
    },
  });
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return serializar({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  });
}

export function itemListJsonLd(planes: PlanBackend[], marca: Marca = MARCA_POR_DEFECTO) {
  return serializar({
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: planes.map((plan, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: plan.nombre_comercial,
        description: plan.descripcion ?? undefined,
        offers: {
          "@type": "Offer",
          price: String(plan.precio_mensual),
          priceCurrency: "CLP",
          availability: "https://schema.org/InStock",
          url: urlDelSitio(marca, `/contratar/${plan.id_plan}`),
        },
      },
    })),
  });
}

type FaqItem = { question: string; answer: string };

export function faqJsonLd(faqs: FaqItem[]) {
  return serializar({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  });
}
