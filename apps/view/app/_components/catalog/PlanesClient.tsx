"use client";

import { useState } from "react";
import {
  idPlanDestacado,
  ordenarPorPrecio,
  type PlanBackend,
} from "../../_lib/api";
import PlanCard from "./PlanCard";
import SegmentFilter from "./SegmentFilter";

type Segmento = "todos" | "RESIDENCIAL" | "EMPRESARIAL";

type PlanesClientProps = {
  planes: PlanBackend[];
};

export default function PlanesClient({ planes }: PlanesClientProps) {
  const [segmento, setSegmento] = useState<Segmento>("RESIDENCIAL");

  const filtered =
    segmento === "todos"
      ? planes
      : planes.filter((p) => p.tipo_cliente === segmento);

  const valid = filtered.filter(
    (p) => p.nombre_comercial && p.precio_mensual != null
  );

  const sorted = ordenarPorPrecio(valid);
  const featuredId = idPlanDestacado(sorted);

  if (planes.length === 0) {
    return (
      <p className="text-muted text-center">
        No hay planes disponibles temporalmente.
      </p>
    );
  }

  return (
    <>
      <SegmentFilter value={segmento} onChange={setSegmento} />

      {sorted.length > 0 ? (
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
        <div className="text-center">
          <p className="text-muted">
            No hay planes disponibles para este segmento.
          </p>
          <button
            type="button"
            onClick={() => setSegmento("todos")}
            className="mt-3 text-sm text-primary hover:underline"
          >
            Ver todos los planes
          </button>
        </div>
      )}
    </>
  );
}
