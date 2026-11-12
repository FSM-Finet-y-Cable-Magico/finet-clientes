import type { Marca } from '../../../_lib/company';

export type SocialLink = { platform: 'instagram' | 'whatsapp'; href: string; label: string };

/** Las redes de la empresa del sitio. */
export const redesDe = (marca: Marca): SocialLink[] => [
  { platform: 'instagram', href: marca.instagramUrl, label: 'Síguenos en Instagram' },
  { platform: 'whatsapp', href: marca.whatsappUrl, label: 'Escríbenos por WhatsApp' },
];
