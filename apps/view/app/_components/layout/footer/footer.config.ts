import { WHATSAPP_URL } from '../../../_lib/company';

export type FooterLink = {
  label: string;
  href: string;
  icon?: string;
  variant?: 'button';
};
export type FooterColumn = { title: string; links: FooterLink[] };

export const footerColumns: FooterColumn[] = [
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
      { label: 'WhatsApp', href: WHATSAPP_URL, icon: 'whatsapp' },
      { label: 'Preguntas Frecuentes', href: '/ayuda' },
    ],
  },
  {
    title: 'Empresas',
    links: [{ label: 'Empresas', href: '/empresas', variant: 'button' }],
  },
];

export const legalLinks: FooterLink[] = [
  { label: 'Términos', href: '/legal/terminos' },
  { label: 'Privacidad', href: '/legal/privacidad' },
  { label: 'Ley 21.398', href: '/legal/ley-21398' },
  { label: 'Reglamento de reclamos', href: '/legal/reclamos' },
  { label: 'Subtel', href: 'https://www.subtel.gob.cl/' },
];
