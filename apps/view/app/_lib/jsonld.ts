import type { PlanBackend } from "./api";
import { BASE_URL } from "./consts";
import { COMPANY_BRAND } from "./company";

type BreadcrumbItem = { name: string; url: string };

export function productJsonLd(plan: PlanBackend) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: plan.nombre_comercial,
    description: plan.descripcion ?? undefined,
    brand: {
      "@type": "Brand",
      name: COMPANY_BRAND,
    },
    offers: {
      "@type": "Offer",
      price: String(plan.precio_mensual),
      priceCurrency: "CLP",
      availability: "https://schema.org/InStock",
      url: `${BASE_URL}/contratar/${plan.id_plan}`,
    },
  });
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return JSON.stringify({
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

export function itemListJsonLd(planes: PlanBackend[]) {
  return JSON.stringify({
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
          url: `${BASE_URL}/contratar/${plan.id_plan}`,
        },
      },
    })),
  });
}

type FaqItem = { question: string; answer: string };

export function faqJsonLd(faqs: FaqItem[]) {
  return JSON.stringify({
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
