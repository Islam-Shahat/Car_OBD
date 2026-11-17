import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';

import { StorageProvider } from '../lib/db/StorageProvider';
import { ThemeProvider } from '../lib/theme/ThemeProvider';
import { SampleReportPage } from '../features/reports/SampleReportPage';
import { router } from './router';

export function App() {
  const [hash, setHash] = useState(() =>
    typeof window !== 'undefined' ? window.location.hash : '',
  );

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (hash.startsWith('#/report-preview')) {
    return (
      <ThemeProvider>
        <SampleReportPage />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <StorageProvider>
        <RouterProvider router={router} />
      </StorageProvider>
    </ThemeProvider>
  );
}
