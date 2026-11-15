import { RouterProvider } from 'react-router-dom';

import { StorageProvider } from '../lib/db/StorageProvider';
import { ThemeProvider } from '../lib/theme/ThemeProvider';
import { router } from './router';

export function App() {
  return (
    <ThemeProvider>
      <StorageProvider>
        <RouterProvider router={router} />
      </StorageProvider>
    </ThemeProvider>
  );
}
