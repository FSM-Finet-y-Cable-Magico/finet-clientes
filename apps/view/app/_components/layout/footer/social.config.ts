import { WHATSAPP_URL } from '../../../_lib/company';

export type SocialLink = { platform: 'instagram' | 'whatsapp'; href: string; label: string };

export const socialLinks: SocialLink[] = [
  { platform: 'instagram', href: 'https://www.instagram.com/finettcl/', label: 'Síguenos en Instagram' },
  { platform: 'whatsapp', href: WHATSAPP_URL, label: 'Escríbenos por WhatsApp' },
];
