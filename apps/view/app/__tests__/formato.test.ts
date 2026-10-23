import {
  fechaCalendario,
  fechaInstante,
  formatPrecio,
} from "@/app/_lib/formato";

// En hora de Chile, para notar si alguna fecha se corre un día.
process.env.TZ = "America/Santiago";

describe("_lib/formato", () => {
  it("formatPrecio: §11.5, $XX.XXX", () => {
    expect(formatPrecio(25990)).toBe("$25.990");
    expect(formatPrecio(0)).toBe("$0");
    expect(formatPrecio(1234567)).toBe("$1.234.567");
  });

  describe("fechaCalendario (sin hora, en UTC)", () => {
    it("no se corre al día anterior", () => {
      expect(fechaCalendario("2026-06-01", "larga")).toBe("1 de junio de 2026");
      expect(fechaCalendario("2026-06-01T00:00:00.000Z", "larga")).toBe(
        "1 de junio de 2026",
      );
    });

    it("estilos corta y numérica", () => {
      expect(fechaCalendario("2026-05-29", "corta")).toBe("29 may");
      expect(fechaCalendario("2026-05-29", "numerica")).toBe("29/05/2026");
    });
  });

  describe("fechaInstante (con hora, en Chile)", () => {
    it("22:30 en Chile sigue siendo ese día aunque en UTC ya sea el siguiente", () => {
      const instante = "2026-05-11T02:30:00.000Z";
      expect(fechaInstante(instante, "numerica")).toBe("10/05/2026");
      expect(fechaInstante(instante, "larga")).toBe("10 de mayo de 2026");
      expect(fechaInstante(instante, "corta")).toBe("10 may");
    });
  });
});
