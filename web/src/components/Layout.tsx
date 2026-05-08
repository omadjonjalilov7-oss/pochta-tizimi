import { useDesign } from '../lib/design';
import { LayoutClassic } from './layouts/LayoutClassic';
import { LayoutGmail } from './layouts/LayoutGmail';
import { LayoutOutlook } from './layouts/LayoutOutlook';
import { LayoutYandex } from './layouts/LayoutYandex';

export function Layout() {
  const design = useDesign();
  if (design === 'gmail') return <LayoutGmail />;
  if (design === 'outlook') return <LayoutOutlook />;
  if (design === 'yandex') return <LayoutYandex />;
  return <LayoutClassic />;
}
