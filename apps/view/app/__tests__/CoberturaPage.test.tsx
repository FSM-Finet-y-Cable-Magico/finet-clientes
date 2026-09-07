import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import CoberturaPage from '@/app/cobertura/page';
import type {
  PuntoCobertura,
  VisorCoberturaConfig,
} from '@/app/_lib/api';

// Leaflet toca `window`/canvas y no corre en jsdom: el visor real se sustituye
// por un doble que expone lo que la pagina le pasa.
jest.mock('@/app/_components/cobertura/VisorCobertura', () => ({
  __esModule: true,
  default: ({
    config,
    puntos,
  }: {
    config: VisorCoberturaConfig;
    puntos: PuntoCobertura[];
  }) => (
    <div
      data-testid="visor-cobertura"
      data-zoom-inicial={config.zoom_inicial}
      data-total-puntos={puntos.length}
    />
  ),
}));

const config: VisorCoberturaConfig = {
  centro: { latitud: -33.6, longitud: -70.61 },
  zoom_inicial: 12,
  zoom_min: 10,
  zoom_max: 18,
  limites: {
    sur_oeste: { latitud: -33.72, longitud: -70.78 },
    nor_este: { latitud: -33.48, longitud: -70.45 },
  },
};

const puntos: PuntoCobertura[] = [
  {
    latitud: -33.583,
    longitud: -70.633,
    densidad_cobertura: 92.5,
    tipo_cobertura: 'fibra',
  },
];

/** La pagina dispara config y puntos en paralelo, en ese orden. */
function mockRespuestas(
  configRes: unknown | null,
  puntosRes: unknown[] | null
) {
  (global.fetch as jest.Mock)
    .mockImplementationOnce(() =>
      configRes === null
        ? Promise.resolve({ ok: false, status: 503 })
        : Promise.resolve({ ok: true, json: () => Promise.resolve(configRes) })
    )
    .mockImplementationOnce(() =>
      puntosRes === null
        ? Promise.resolve({ ok: false, status: 503 })
        : Promise.resolve({ ok: true, json: () => Promise.resolve(puntosRes) })
    );
}

describe('CoberturaPage (CU-59 a CU-62)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('CU-59: despliega el visor con el encuadre entregado por el backend', async () => {
    mockRespuestas(config, puntos);

    render(await CoberturaPage());

    const visor = screen.getByTestId('visor-cobertura');
    expect(visor).toBeInTheDocument();
    expect(visor).toHaveAttribute('data-zoom-inicial', '12');
  });

  it('CU-60: pasa al visor los puntos de la capa de calor', async () => {
    mockRespuestas(config, puntos);

    render(await CoberturaPage());

    expect(screen.getByTestId('visor-cobertura')).toHaveAttribute(
      'data-total-puntos',
      '1'
    );
    expect(
      screen.queryByText(/capa de cobertura no esta disponible/i)
    ).not.toBeInTheDocument();
  });

  it('CU-59 Excepcion 2: informa que el visor no esta disponible si falla la config', async () => {
    mockRespuestas(null, puntos);

    render(await CoberturaPage());

    expect(
      screen.getByText(/el visor no esta disponible temporalmente/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId('visor-cobertura')).not.toBeInTheDocument();
  });

  it('CU-60 Excepcion 1: muestra el visor sin capa tematica si no hay datos', async () => {
    mockRespuestas(config, null);

    render(await CoberturaPage());

    expect(screen.getByTestId('visor-cobertura')).toHaveAttribute(
      'data-total-puntos',
      '0'
    );
    expect(
      screen.getByText(/capa de cobertura no esta disponible/i)
    ).toBeInTheDocument();
  });
});
