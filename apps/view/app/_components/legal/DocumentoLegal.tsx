import type { ReactNode } from "react";

export type SeccionLegal = {
  /** Ancla de la sección: el footer enlaza a algunas (`/terminos#reclamos`). */
  id: string;
  titulo: string;
  contenido: ReactNode;
};

type DocumentoLegalProps = {
  titulo: string;
  /** Razón social, RUT, fecha de actualización. */
  encabezado: ReactNode;
  secciones: SeccionLegal[];
};

function Indice({ secciones }: { secciones: SeccionLegal[] }) {
  return (
    <ol className="space-y-1 border-l border-border text-sm">
      {secciones.map((seccion, i) => (
        <li key={seccion.id}>
          <a
            href={`#${seccion.id}`}
            className="-ml-px block border-l-2 border-transparent py-1 pl-4 text-muted transition-colors hover:border-primary hover:text-foreground"
          >
            {i + 1}. {seccion.titulo}
          </a>
        </li>
      ))}
    </ol>
  );
}

/** CU-73: esqueleto de Términos y Privacidad, con índice y secciones numeradas. */
export default function DocumentoLegal({
  titulo,
  encabezado,
  secciones,
}: DocumentoLegalProps) {
  return (
    <div className="px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-6xl lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
        <aside className="hidden lg:block">
          <nav aria-label="Índice" className="sticky top-24">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
              En esta página
            </p>
            <Indice secciones={secciones} />
          </nav>
        </aside>

        <article className="max-w-3xl">
          <header className="border-b border-border pb-8">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-bright">
              Legal
            </p>
            <h1 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">
              {titulo}
            </h1>
            <div className="mt-4 text-sm leading-6 text-muted">{encabezado}</div>
          </header>

          <details className="mt-6 rounded-xl border border-border px-4 py-3 lg:hidden">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              Índice
            </summary>
            <nav aria-label="Índice" className="mt-3">
              <Indice secciones={secciones} />
            </nav>
          </details>

          {secciones.map((seccion, i) => (
            <section
              key={seccion.id}
              id={seccion.id}
              aria-labelledby={`${seccion.id}-titulo`}
              // scroll-mt: que el header sticky no tape el titulo al llegar por ancla.
              className="scroll-mt-24 border-b border-border py-10 last:border-b-0"
            >
              <h2
                id={`${seccion.id}-titulo`}
                className="flex gap-3 text-xl font-bold text-foreground sm:text-2xl"
              >
                <span className="tabular-nums text-primary-bright">{i + 1}.</span>
                {seccion.titulo}
              </h2>
              <div className="mt-5 space-y-4 text-base leading-7 text-foreground/90 [&_a]:font-medium [&_a]:text-primary-bright [&_a]:underline [&_a]:underline-offset-2 [&_h3]:scroll-mt-24 [&_h3]:pt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
                {seccion.contenido}
              </div>
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
