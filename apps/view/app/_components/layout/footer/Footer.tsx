import FooterNav from './FooterNav';
import SocialLinks from './SocialLinks';
import Copyright from './Copyright';
import type { Marca } from '../../../_lib/company';

export default function Footer({ marca }: { marca: Marca }) {
  return (
    <footer className="mt-auto bg-surface border-t border-border">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <FooterNav marca={marca} />
          </div>
          <div className="shrink-0">
            <SocialLinks marca={marca} />
          </div>
        </div>
      </div>
      <Copyright marca={marca} />
    </footer>
  );
}
