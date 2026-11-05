import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^react-markdown$': '<rootDir>/test/mocks/react-markdown.tsx',
    '^remark-gfm$': '<rootDir>/test/mocks/remark-gfm.ts',
  },
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
};

const configurar = createJestConfig(config);

/**
 * `jose` se publica solo como ESM, así que jest tiene que transformarlo en vez
 * de ignorarlo como al resto de node_modules. Lo usan el proxy (verificación
 * del JWT) y la cookie cifrada del consentimiento (CU-76 / RNF-57.1).
 *
 * La lista de next/jest se reemplaza en vez de extenderse porque sus patrones
 * excluyen todo node_modules salvo un puñado de paquetes de Next.
 */
const conJose = async (): Promise<Config> => {
  const resuelta = (await configurar()) as Config;
  return {
    ...resuelta,
    transformIgnorePatterns: [
      'node_modules/(?!.*jose)',
      '^.+\\.module\\.(css|sass|scss)$',
    ],
  };
};

export default conJose;
