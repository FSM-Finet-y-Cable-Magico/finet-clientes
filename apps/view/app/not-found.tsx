import MarcaShell from "./_components/layout/MarcaShell";
import NoEncontrado from "./_components/layout/NoEncontrado";

/** 404 fuera del sitio de una empresa: con la marca por defecto. */
export default function NotFound() {
  return (
    <MarcaShell slug="finet">
      <NoEncontrado />
    </MarcaShell>
  );
}
