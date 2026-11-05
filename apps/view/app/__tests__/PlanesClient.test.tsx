import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import PlanesClient from "@/app/_components/catalog/PlanesClient";
import type { PlanBackend } from "@/app/_lib/api";

function plan(id: number, precio: number, tipo = "RESIDENCIAL"): PlanBackend {
  return {
    id_plan: id,
    nombre_comercial: `Plan ${id}`,
    tipo_plan: "FIBRA",
    tipo_cliente: tipo,
    velocidad_mbps: 100 * id,
    precio_mensual: precio,
    descripcion: null,
  };
}

describe("PlanesClient", () => {
  it("ordena de menor a mayor precio y destaca el del medio", () => {
    const planes = [plan(1, 29990), plan(2, 15990), plan(3, 21990), plan(4, 9990)];

    render(<PlanesClient planes={planes} />);

    const tarjetas = screen.getAllByRole("article");
    expect(tarjetas.map((t) => within(t).getByRole("heading").textContent)).toEqual([
      "Plan 4",
      "Plan 2",
      "Plan 3",
      "Plan 1",
    ]);
    // Cuatro planes: el del medio es el índice 2.
    expect(within(tarjetas[2]).getByText("Mas popular")).toBeInTheDocument();
    expect(screen.getAllByText("Mas popular")).toHaveLength(1);
    // No reordena el arreglo que recibe.
    expect(planes.map((p) => p.id_plan)).toEqual([1, 2, 3, 4]);
  });

  it("con un solo plan no destaca ninguno", () => {
    render(<PlanesClient planes={[plan(1, 15990)]} />);
    expect(screen.queryByText("Mas popular")).not.toBeInTheDocument();
  });
});
