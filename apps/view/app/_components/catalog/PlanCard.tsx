import type { PlanBackend } from "../../_lib/api";
import { formatPrecio } from "../../_lib/formato";
import PrimaryButton from "../ui/PrimaryButton";

type PlanCardProps = {
  plan: PlanBackend;
  featured?: boolean;
};

function buildFeatures(plan: PlanBackend): string[] {
  const features: string[] = [];
  if (plan.velocidad_mbps) {
    features.push(
      plan.tipo_plan === "fibra"
        ? `Fibra optica ${plan.velocidad_mbps} Mbps simetricos`
        : `${plan.velocidad_mbps} Mbps de velocidad`
    );
  }
  features.push("Instalacion incluida");
  features.push("Datos ilimitados");
  features.push("Soporte local en La Pintana");
  return features;
}

export default function PlanCard({ plan, featured }: PlanCardProps) {
  const features = buildFeatures(plan);

  return (
    <article
      className={`card-lift relative border border-border p-6 rounded-xl transition-all hover:border-primary ${
        featured ? "ring-2 ring-primary" : ""
      }`}
    >
      {featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-4 py-0.5 text-xs font-bold text-on-accent">
          Mas popular
        </span>
      )}
      <h2 className="text-lg font-medium">{plan.nombre_comercial}</h2>
      <p className="text-4xl font-extrabold text-foreground mt-2">
        {formatPrecio(plan.precio_mensual)}
        <span className="text-sm font-normal text-muted">/mes</span>
      </p>
      {plan.descripcion && (
        <p className="text-sm text-muted mt-1">
          {plan.descripcion}
        </p>
      )}
      <ul className="mt-4 grid gap-2 border-t border-border pt-4">
        {features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-2 text-sm text-foreground"
          >
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
            {feature}
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <PrimaryButton
          href={`/contratar/${plan.id_plan}`}
          variant="conversion"
          className="w-full"
        >
          Contratar {plan.nombre_comercial}
        </PrimaryButton>
      </div>
    </article>
  );
}
