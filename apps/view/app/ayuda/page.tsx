import type { Metadata } from "next";
import { faqJsonLd } from "../_lib/jsonld";
import { WHATSAPP_URL } from "../_lib/company";

export const metadata: Metadata = {
  title: "Ayuda y Preguntas Frecuentes",
  description:
    "Resuelve tus dudas sobre contratacion, instalacion, cobertura, pagos y soporte de Finet. Preguntas frecuentes de Internet fibra optica en La Pintana y Puente Alto.",
};

const faqs = [
  {
    question: "¿Que necesito para contratar?",
    answer:
      "Solo tu RUT chileno vigente y la direccion de instalacion. Puedes contratar directamente desde nuestra pagina de planes. Te contactaremos en menos de 24 horas para coordinar la visita del tecnico.",
  },
  {
    question: "¿Cuanto demora la instalacion?",
    answer:
      "La instalacion se agenda dentro de las 24 horas siguientes a la contratacion y se realiza en un plazo de 24 a 72 horas habiles, dependiendo de la disponibilidad en tu comuna. El tecnico instala la fibra optica, el router Wi-Fi y configura todo en tu hogar.",
  },
  {
    question: "¿Los planes tienen limite de datos?",
    answer:
      "No. Todos nuestros planes de Internet fibra optica incluyen datos ilimitados. Navega, haz streaming, juega online y realiza videollamadas sin preocuparte por limites de consumo.",
  },
  {
    question: "¿En que comunas tienen cobertura?",
    answer:
      "Actualmente tenemos cobertura en La Pintana, Puente Alto, La Florida, La Granja, El Bosque y San Ramon. Estamos expandiendo nuestra red. Si no estas en estas comunas, consulta igualmente: revisamos tu direccion y te avisamos cuando lleguemos a tu zona.",
  },
  {
    question: "¿Que hago si tengo problemas de conexion?",
    answer:
      "Puedes contactar a soporte tecnico por WhatsApp, llamada telefonica o creando un ticket desde tu Portal Cliente. Recomendamos primero reiniciar el router (desconectarlo 30 segundos y volver a conectarlo). Si el problema persiste, nuestro equipo tecnico te asistira de forma remota o coordinara una visita.",
  },
  {
    question: "¿Como puedo pagar?",
    answer:
      "El pago es mensual mediante factura electronica. Recibiras tu factura por correo cada mes con la fecha de vencimiento. Pronto habilitaremos el pago en linea desde el Portal Cliente. Si tienes dudas sobre tu factura, contactanos por WhatsApp.",
  },
];

export default function AyudaPage() {
  return (
    <section className="px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: faqJsonLd(faqs),
        }}
      />
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-foreground">
            Preguntas frecuentes
          </h1>
          <p className="text-muted mt-3">
            Encuentra respuestas rapidas sobre nuestros servicios de Internet
            fibra optica.
          </p>
        </div>
        <div className="grid gap-6">
          {faqs.map((faq) => (
            <details
              key={faq.question}
              className="group border border-border rounded-xl"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 p-5 font-medium text-foreground marker:content-none group-open:border-b group-open:border-border">
                {faq.question}
                <svg
                  className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </summary>
              <div className="px-5 pb-5 pt-4 text-sm text-muted leading-relaxed">
                {faq.answer}
              </div>
            </details>
          ))}
        </div>
        <div className="text-center mt-12">
          <p className="text-sm text-muted">
            ¿No encuentras lo que buscas?{" "}
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Contacta a soporte
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
