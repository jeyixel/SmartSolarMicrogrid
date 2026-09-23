import React, { useState } from 'react';
import { AuthProvider, useAuth, UserRole } from './contexts/AuthContext';
import { GridOperatorView } from './components/GridOperatorView';
import { BackofficeView } from './components/BackofficeView';
import { ReservationDashboard } from './pages/reservation/ReservationDashboard';
import { StationScheduleManager } from './pages/reservation/StationScheduleManager';
import { Toaster } from './components/ui/toaster';
import {
  Sun,
  BatteryCharging,
  CalendarCheck,
  Settings,
  LayoutDashboard,
} from 'lucide-react';
import './App.css';

type TabId = 'overview' | 'reservations' | 'stations';

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const TABS: Record<UserRole, TabConfig[]> = {
  GridOperator: [
    { id: 'reservations', label: 'Reservations',    icon: CalendarCheck   },
    { id: 'overview',     label: 'Slot Management', icon: BatteryCharging },
    { id: 'stations',     label: 'Station Manager', icon: Settings        },
  ],
  Backoffice: [
    { id: 'reservations', label: 'Reservation Management', icon: CalendarCheck   },
    { id: 'overview',     label: 'System Overview',        icon: LayoutDashboard },
  ],
};

// ─── Inner layout (needs AuthContext) ────────────────────────────────────────
const AppShell: React.FC = () => {
  const { user, role, setRole } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('reservations');

  const tabs = TABS[role];

  // Reset to first tab whenever role switches
  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    setActiveTab(TABS[newRole][0].id);
  };

  const renderPage = () => {
    switch (activeTab) {
      case 'reservations': return <ReservationDashboard />;
      case 'stations':     return <StationScheduleManager />;
      case 'overview':
      default:
        return role === 'GridOperator' ? <GridOperatorView /> : <BackofficeView />;
    }
  };

  return (
    <div className="min-h-screen bg-background">

      {/* ── Top bar ── */}
      <header className="h-12 border-b border-slate-200 bg-white flex items-center justify-between px-4 sticky top-0 z-40">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <Sun className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <span className="text-headline-sm text-slate-900">SmartSolar</span>
          <span className="hidden sm:block text-label-sm text-muted-foreground uppercase tracking-wider ml-1">
            Microgrid Control
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {/* Role toggle */}
          <div className="flex items-center gap-2">
            <span className="text-body-sm text-muted-foreground hidden sm:block">Role:</span>
            <select
              className="h-7 px-2 text-body-sm rounded border border-slate-300 bg-white text-slate-800
                         focus:outline-none focus:border-primary cursor-pointer"
              value={role}
              onChange={e => handleRoleChange(e.target.value as UserRole)}
              aria-label="Switch active role"
            >
              <option value="GridOperator">Grid Operator</option>
              <option value="Backoffice">Backoffice</option>
            </select>
          </div>

          {/* Mock user badge */}
          <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-label-sm text-primary font-mono font-semibold">
                {user.name[0]}
              </span>
            </div>
            <div className="hidden sm:block">
              <p className="text-body-sm text-slate-800 leading-none">{user.name}</p>
              <p className="text-label-sm text-muted-foreground font-mono leading-none mt-0.5">
                {user.id}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Tab navigation ── */}
      <nav className="border-b border-slate-200 bg-white px-4 flex gap-0 sticky top-12 z-30">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={[
              'flex items-center gap-1.5 h-10 px-4 text-body-md border-b-2 transition-colors',
              activeTab === id
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-slate-800 hover:border-slate-300',
            ].join(' ')}
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </nav>

      {/* ── Page content ── */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {renderPage()}
      </main>

      {/* ── Toast portal ── */}
      <Toaster />
    </div>
  );
};

// ─── Root ────────────────────────────────────────────────────────────────────
function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
