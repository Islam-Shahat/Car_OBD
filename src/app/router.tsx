import { createHashRouter, Navigate } from 'react-router-dom';

import { ConnectionPage } from '../features/connection/ConnectionPage';
import { HistoryPage } from '../features/history/HistoryPage';
import { ScanPage } from '../features/scan/ScanPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { VehiclesPage } from '../features/vehicles/VehiclesPage';
import { AppLayout } from './AppLayout';

// Hash routing keeps deep links working when the app is served from Tauri's asset protocol.
export const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <ConnectionPage /> },
      { path: 'scan', element: <ScanPage /> },
      { path: 'vehicles', element: <VehiclesPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
