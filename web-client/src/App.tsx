import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { GridOperatorView } from './components/GridOperatorView';
import { BackofficeView } from './components/BackofficeView';
import { Sun } from 'lucide-react';
import './App.css'; // or any CSS

const MainContent: React.FC = () => {
  const { role, setRole } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
      <header className="flex justify-between items-center mb-8 border-b pb-4">
        <div className="flex items-center gap-2">
          <Sun className="w-8 h-8 text-yellow-500" />
          <h1 className="text-2xl font-bold">Smart Solar Microgrid</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Active Role:</span>
          <select 
            className="p-2 border rounded bg-white text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
          >
            <option value="Grid Operator">Grid Operator</option>
            <option value="Backoffice">Backoffice</option>
          </select>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        {role === 'Grid Operator' ? <GridOperatorView /> : <BackofficeView />}
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}

export default App;
