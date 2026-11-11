import { useTranslation } from 'react-i18next';

import { EmptyState } from '../../app/EmptyState';
import { IconHistory } from '../../app/icons';
import { PageHeader } from '../../app/PageHeader';

export function HistoryPage() {
  const { t } = useTranslation();

  return (
    <>
      <PageHeader title={t('pages.history.title')} subtitle={t('pages.history.subtitle')} />
      <EmptyState
        icon={<IconHistory className="size-7" />}
        badge={t('common.comingSoon')}
        title={t('pages.history.emptyTitle')}
        body={t('pages.history.emptyBody')}
      />
    </>
  );
}
