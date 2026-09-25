import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { Fab } from './Fab';
import { Placeholder } from './pages/Placeholder';
import { SettingsPage } from './pages/SettingsPage';
import { requestPersistence } from './storage';

export function App() {
  useEffect(() => {
    void requestPersistence();
  }, []);
  return (
    <HashRouter>
      <div className="app">
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to="/dias" replace />} />
            <Route path="/dias" element={<Placeholder title="Días" />} />
            <Route path="/dias/:day" element={<Placeholder title="Día" />} />
            <Route path="/graficas" element={<Placeholder title="Gráficas" />} />
            <Route path="/manos" element={<Placeholder title="Manos" />} />
            <Route path="/manos/:id" element={<Placeholder title="Mano" />} />
            <Route path="/subir" element={<Placeholder title="Subir" />} />
            <Route path="/ajustes" element={<SettingsPage />} />
          </Routes>
        </main>
        <Fab />
        <BottomNav />
      </div>
    </HashRouter>
  );
}
