import { estadoContratoBadge } from "@/app/_lib/estado-contrato";

describe("estadoContratoBadge (Tabla 11.15 del Documento 0)", () => {
  it("mapea los seis estados canonicos", () => {
    expect(estadoContratoBadge("ACTIVO").label).toBe("Activo");
    expect(estadoContratoBadge("SUSPENDIDO").label).toBe("Suspendido");
    expect(estadoContratoBadge("CORTADO").label).toBe("Cortado");
    expect(estadoContratoBadge("BAJA").label).toBe("De baja");
    expect(estadoContratoBadge("PENDIENTE").label).toBe("En trámite");
    expect(estadoContratoBadge("REACTIVADO").label).toBe("Reactivado");
  });

  it("distingue por color el servicio caido del que esta al dia", () => {
    expect(estadoContratoBadge("ACTIVO").tone).toBe("success");
    expect(estadoContratoBadge("SUSPENDIDO").tone).toBe("warning");
    expect(estadoContratoBadge("CORTADO").tone).toBe("error");
  });

  // En la base compartida conviven valores en minuscula escritos antes de
  // unificar el vocabulario.
  it("acepta minusculas y alias historicos", () => {
    expect(estadoContratoBadge("activo").label).toBe("Activo");
    expect(estadoContratoBadge("en_tramite").label).toBe("En trámite");
    expect(estadoContratoBadge("inactivo").label).toBe("De baja");
  });

  it("muestra tal cual un estado desconocido en vez de dejar el hueco", () => {
    expect(estadoContratoBadge("HIBERNANDO")).toEqual({
      label: "HIBERNANDO",
      tone: "neutral",
    });
  });
});
