import Image from 'next/image';
import Link from 'next/link';
import { rutaMarca, type Marca } from '../../../_lib/company';

/** El logo de la empresa del sitio, que lleva a su inicio. */
export default function NavLogo({ marca }: { marca: Marca }) {
  return (
    <Link href={rutaMarca(marca, '/')} className="flex items-center shrink-0">
      <Image
        src={marca.logo.webp}
        alt={marca.logo.alt}
        width={marca.logo.ancho}
        height={marca.logo.alto}
        priority
        className="h-10 w-auto"
      />
    </Link>
  );
}
