import { useTranslation } from 'react-i18next';

import { EmptyState } from '../../app/EmptyState';
import { IconScan } from '../../app/icons';
import { PageHeader } from '../../app/PageHeader';

export function ScanPage() {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader title={t('pages.scan.title')} subtitle={t('pages.scan.subtitle')} />
      <EmptyState
        icon={<IconScan className="size-7" />}
        badge={t('common.comingSoon')}
        title={t('pages.scan.emptyTitle')}
        body={t('pages.scan.emptyBody')}
      />
    </>
  );
}
