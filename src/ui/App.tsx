import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useDb } from '../db/context';
import { attachSync } from '../sync/runner';
import { BottomNav } from './BottomNav';
import { Fab } from './Fab';
import { ChartsPage } from './pages/ChartsPage';
import { DayDetailPage } from './pages/DayDetailPage';
import { DaysPage } from './pages/DaysPage';
import { HandDetailPage } from './pages/HandDetailPage';
import { HandsPage } from './pages/HandsPage';
import { SettingsPage } from './pages/SettingsPage';
import { UploadPage } from './pages/UploadPage';
import { requestPersistence } from './storage';

export function App() {
  const db = useDb();
  useEffect(() => {
    void requestPersistence();
  }, []);
  useEffect(() => attachSync(db), [db]);
  return (
    <HashRouter>
      <div className="app">
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to="/dias" replace />} />
            <Route path="/dias" element={<DaysPage />} />
            <Route path="/dias/:day" element={<DayDetailPage />} />
            <Route path="/graficas" element={<ChartsPage />} />
            <Route path="/manos" element={<HandsPage />} />
            <Route path="/manos/:id" element={<HandDetailPage />} />
            <Route path="/subir" element={<UploadPage />} />
            <Route path="/ajustes" element={<SettingsPage />} />
          </Routes>
        </main>
        <Fab />
        <BottomNav />
      </div>
    </HashRouter>
  );
}
