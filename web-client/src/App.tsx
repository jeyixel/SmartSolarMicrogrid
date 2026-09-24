import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from '@/components/AppLayout';
import { SessionProvider } from '@/context/SessionContext';
import { StationDetailPage } from '@/pages/StationDetailPage';
import { StationFormPage } from '@/pages/StationFormPage';
import { StationListPage } from '@/pages/StationListPage';

function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/stations" replace />} />
            <Route path="stations" element={<StationListPage />} />
            {/* "new" precedes ":id" so it is not read as a station id. */}
            <Route path="stations/new" element={<StationFormPage />} />
            <Route path="stations/:id" element={<StationDetailPage />} />
            <Route path="stations/:id/edit" element={<StationFormPage />} />
            <Route path="*" element={<Navigate to="/stations" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}

export default App;
