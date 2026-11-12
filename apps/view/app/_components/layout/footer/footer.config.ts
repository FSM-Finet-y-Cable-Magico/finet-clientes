import type { Marca } from '../../../_lib/company';

export type FooterLink = {
  label: string;
  href: string;
  icon?: string;
  variant?: 'button';
};
export type FooterColumn = { title: string; links: FooterLink[] };

/** Las columnas del pie del sitio de una empresa: el WhatsApp es el suyo. */
export const columnasDelPie = (marca: Marca): FooterColumn[] => [
  {
    title: 'Acciones',
    links: [
      { label: 'Paga tu cuenta', href: '/consultar-deuda', icon: 'credit-card' },
      { label: 'Test de velocidad', href: '/velocidad', icon: 'gauge' },
      { label: 'Cobertura', href: '/cobertura', icon: 'map-pin' },
      { label: 'Portal Cliente', href: '/perfil', icon: 'user' },
    ],
  },
  {
    title: 'Te ayudamos',
    links: [
      { label: 'WhatsApp', href: marca.whatsappUrl, icon: 'whatsapp' },
      { label: 'Preguntas Frecuentes', href: '/ayuda' },
    ],
  },
  {
    title: 'Empresas',
    links: [{ label: 'Empresas', href: '/empresas', variant: 'button' }],
  },
];

export const legalLinks: FooterLink[] = [
  // CU-73: Ley 21.398 y el reglamento de reclamos son secciones de Términos,
  // no páginas propias.
  { label: 'Términos', href: '/terminos' },
  { label: 'Privacidad', href: '/privacidad' },
  { label: 'Reclamos', href: '/terminos#reclamos' },
  { label: 'Subtel', href: 'https://tramites.subtel.gob.cl' },
];
