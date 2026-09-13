import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import FormularioContratacion from "../../_components/catalog/FormularioContratacion";
import { getLandingPlanes, getPlanById, formatPrecioMensual } from "../../_lib/api";
import { productJsonLd, breadcrumbJsonLd } from "../../_lib/jsonld";
import { BASE_URL } from "../../_lib/consts";
import { metadataPlan } from "../../_lib/seo";

type ContratarPlanPageProps = {
  params: Promise<{
    planId: string;
  }>;
};

export async function generateStaticParams() {
  const planes = await getLandingPlanes();
  return planes.map((plan) => ({
    planId: String(plan.id_plan),
  }));
}

export async function generateMetadata({
  params,
}: ContratarPlanPageProps): Promise<Metadata> {
  const { planId } = await params;
  const plan = await getPlanById(Number(planId));
  return metadataPlan(plan, `/contratar/${planId}`);
}

export default async function ContratarPlanPage({ params }: ContratarPlanPageProps) {
  const { planId } = await params;
  const plan = await getPlanById(Number(planId));

  if (!plan) {
    redirect("/planes");
  }

  return (
    <section className="px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: productJsonLd(plan),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: "Inicio", url: BASE_URL },
            { name: "Planes", url: `${BASE_URL}/planes` },
            { name: plan.nombre_comercial, url: `${BASE_URL}/contratar/${plan.id_plan}` },
          ]),
        }}
      />
      <nav aria-label="Breadcrumb" className="mx-auto max-w-7xl mb-4">
        <ol className="flex items-center gap-2 text-sm text-muted">
          <li>
            <Link href="/" className="hover:text-foreground transition-colors">
              Inicio
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/planes" className="hover:text-foreground transition-colors">
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
          {formatPrecioMensual(plan.precio_mensual)}/mes
        </p>
        <FormularioContratacion plan={plan} />
      </div>
    </section>
  );
}
