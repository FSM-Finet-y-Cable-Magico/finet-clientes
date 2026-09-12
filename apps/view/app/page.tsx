import type { Metadata } from "next";
import Image from "next/image";
import { Hero } from "./_components/layout/hero/Hero";
import PlanCard from "./_components/catalog/PlanCard";
import PrimaryButton from "./_components/ui/PrimaryButton";
import { getLandingPlanes } from "./_lib/api";
import {
  Zap,
  Wifi,
  Headphones,
  ShieldCheck,
  MapPin,
  MapPinned,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Internet Fibra Optica en La Pintana y Puente Alto | Finet",
  description:
    "Internet de fibra optica simetrica desde 200 Mbps. Sin limites de datos, instalacion incluida. Planes hogar y empresa en La Pintana, Puente Alto, La Florida y La Granja.",
  openGraph: {
    title: "Finet — Internet Fibra Optica | La Pintana y Puente Alto",
    description:
      "Fibra optica simetrica de alta velocidad. Planes desde $19.990/mes en la zona sur de Santiago.",
  },
};

const beneficios = [
  {
    icon: Zap,
    title: "Fibra optica simetrica",
    desc: "Misma velocidad de subida y bajada. Ideal para videollamadas, gaming y streaming.",
  },
  {
    icon: Wifi,
    title: "Wi-Fi de alto rendimiento",
    desc: "Equipo incluido con la instalacion. Cobertura optima para toda tu casa.",
  },
  {
    icon: Headphones,
    title: "Soporte local",
    desc: "Atencion directa en La Pintana. Te ayudamos por telefono, WhatsApp y presencial.",
  },
  {
    icon: ShieldCheck,
    title: "Sin limites de datos",
    desc: "Navega, descarga y streamea sin restricciones. Datos ilimitados en todos los planes.",
  },
];

const comunas = [
  "La Pintana",
  "Puente Alto",
  "La Florida",
  "La Granja",
  "El Bosque",
  "San Ramon",
];

export default async function HomePage() {
  const planes = await getLandingPlanes();

  const sorted = [...planes].sort(
    (a, b) => a.precio_mensual - b.precio_mensual,
  );
  const featuredId =
    sorted.length >= 2 ? sorted[Math.floor(sorted.length / 2)].id_plan : null;

  return (
    <>
      {/* ==================== HERO ==================== */}
      <Hero />

      {/* ==================== BENEFICIOS ==================== */}
      <section
        aria-labelledby="beneficios-heading"
        className="px-4 py-20 bg-surface"
      >
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2
              id="beneficios-heading"
              className="text-3xl font-bold text-foreground"
            >
              Por que elegir Finet
            </h2>
            <p className="text-muted mt-3 max-w-xl mx-auto">
              Internet de fibra optica pensado para tu hogar, con la mejor
              relacion precio-calidad del sur de Santiago.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {beneficios.map((b) => (
              <div key={b.title} className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-4">
                  <b.icon size={28} strokeWidth={1.5} />
                </div>
                <h3 className="font-semibold text-foreground">{b.title}</h3>
                <p className="text-sm text-muted mt-2">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== PLANES DESTACADOS ==================== */}
      <section aria-labelledby="planes-heading" className="px-4 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2
              id="planes-heading"
              className="text-3xl font-bold text-foreground"
            >
              Planes de Internet
            </h2>
            <p className="text-muted mt-3 max-w-xl mx-auto">
              Conexion simetrica sin limites de datos. Instalacion incluida en
              todas las comunas con cobertura.
            </p>
          </div>
          {planes.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-3">
              {sorted.map((plan) => (
                <PlanCard
                  key={plan.id_plan}
                  plan={plan}
                  featured={plan.id_plan === featuredId}
                />
              ))}
            </div>
          ) : (
            <p className="text-muted text-center">
              No hay planes disponibles temporalmente.
            </p>
          )}
          <div className="text-center mt-10">
            <PrimaryButton href="/planes" variant="outline">
              Ver todos los planes
            </PrimaryButton>
          </div>
        </div>
      </section>

      {/* ==================== COBERTURA ==================== */}
      <section
        aria-labelledby="cobertura-heading"
        className="relative px-4 py-20 bg-surface overflow-hidden"
      >
        <Image
          src="/home/cobertura.webp"
          // Decorativa: el titulo y las comunas listadas ya dicen todo lo
          // que la foto aporta.
          alt=""
          fill
          loading="lazy"
          sizes="100vw"
          className="object-cover"
        />
        {/* Scrim claro: mantiene legible el texto oscuro que ya usa esta
            seccion sin tener que rehacer sus colores para fondo oscuro. */}
        <div
          className="absolute inset-0 bg-surface/60 backdrop-blur-xs"
          aria-hidden
        />
        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2
              id="cobertura-heading"
              className="text-3xl font-bold text-foreground"
            >
              Zona de cobertura
            </h2>
            <p className="opacity-60 mt-3 max-w-xl mx-auto">
              Estamos presentes en las siguientes comunas del sur de Santiago.
              Consulta disponibilidad en tu direccion.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-3xl mx-auto">
            {comunas.map((comuna) => (
              <div
                key={comuna}
                className="flex items-center gap-3 border border-border rounded-xl p-4 bg-background"
              >
                <MapPin size={20} className="shrink-0 text-primary" />
                <span className="font-medium text-foreground">{comuna}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <PrimaryButton href="/cobertura" variant="solid">
              <MapPinned size={18} aria-hidden />
              Ver mapa de cobertura
            </PrimaryButton>
          </div>
        </div>
      </section>

      {/* ==================== CTA FINAL ==================== */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-foreground">
            Listo para conectarte?
          </h2>
          <p className="text-muted mt-3">
            Elige tu plan y solicita la instalacion hoy. Te contactamos en menos
            de 24 horas.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <PrimaryButton href="/planes" variant="solid">
              Ver planes
            </PrimaryButton>
            <PrimaryButton href="/cobertura" variant="outline">
              Consultar cobertura
            </PrimaryButton>
          </div>
        </div>
      </section>
    </>
  );
}
