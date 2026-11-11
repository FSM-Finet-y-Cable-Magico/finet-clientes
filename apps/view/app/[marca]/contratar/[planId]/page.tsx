import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import FormularioContratacion from "../../../_components/catalog/FormularioContratacion";
import { getLandingPlanes, getPlanById } from "../../../_lib/api";
import { formatPrecio } from "../../../_lib/formato";
import { productJsonLd, breadcrumbJsonLd, urlDelSitio } from "../../../_lib/jsonld";
import { metadataPlan } from "../../../_lib/seo";
import { marcaPorEmpresa, marcaPorSlug, rutaMarca } from "../../../_lib/company";

type ContratarPlanPageProps = {
  params: Promise<{
    marca: string;
    planId: string;
  }>;
};

/** Cada sitio genera la contratación de sus planes. */
export async function generateStaticParams({
  params,
}: {
  params: { marca: string };
}) {
  const marca = marcaPorSlug(params.marca);
  const planes = await getLandingPlanes(undefined, marca.idEmpresa);
  return planes.map((plan) => ({
    planId: String(plan.id_plan),
  }));
}

export async function generateMetadata({
  params,
}: ContratarPlanPageProps): Promise<Metadata> {
  const { marca, planId } = await params;
  const plan = await getPlanById(Number(planId));
  return metadataPlan(plan, `/contratar/${planId}`, marcaPorSlug(marca));
}

export default async function ContratarPlanPage({ params }: ContratarPlanPageProps) {
  const { marca: slug, planId } = await params;
  const marca = marcaPorSlug(slug);
  const plan = await getPlanById(Number(planId));

  if (!plan) {
    redirect(rutaMarca(marca, "/planes"));
  }

  // Un plan se contrata en el sitio de su empresa: el prospecto queda en ella.
  const deLaEmpresa = marcaPorEmpresa(plan.id_empresa);
  if (plan.id_empresa != null && deLaEmpresa.slug !== marca.slug) {
    redirect(rutaMarca(deLaEmpresa, `/contratar/${planId}`));
  }

  return (
    <section className="px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: productJsonLd(plan, marca),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: "Inicio", url: urlDelSitio(marca, "/") },
            { name: "Planes", url: urlDelSitio(marca, "/planes") },
            {
              name: plan.nombre_comercial,
              url: urlDelSitio(marca, `/contratar/${plan.id_plan}`),
            },
          ]),
        }}
      />
      <nav aria-label="Breadcrumb" className="mx-auto max-w-7xl mb-4">
        <ol className="flex items-center gap-2 text-sm text-muted">
          <li>
            <Link href={rutaMarca(marca, "/")} className="hover:text-foreground transition-colors">
              Inicio
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={rutaMarca(marca, "/planes")} className="hover:text-foreground transition-colors">
              Planes
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-foreground truncate max-w-[200px]">
            {plan.nombre_comercial}
          </li>
        </ol>
      </nav>
      <div className="mx-auto grid max-w-7xl gap-4">
        <h1 className="text-2xl font-medium">Solicitud de contratacion</h1>
        <p className="text-muted">
          Plan seleccionado: <strong>{plan.nombre_comercial}</strong> &mdash;{" "}
          {formatPrecio(plan.precio_mensual)}/mes
        </p>
        <FormularioContratacion plan={plan} />
      </div>
    </section>
  );
}
