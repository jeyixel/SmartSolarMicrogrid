import React, { useState } from 'react';
import { Link } from 'react-router';
import {
  Zap,
  BatteryCharging,
  Clock,
  CalendarCheck,
  CalendarOff,
  Layers,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Sliders,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';

// ─── Mock Data for Grid Officer Operations ─────────────────────────────────────

interface MockReservationItem {
  id: string;
  prosumerNIC: string;
  stationId: string;
  stationName: string;
  timeWindow: string;
  energyAmountKWh: number;
  actionType: 'Drop-off' | 'Charge';
  status: 'Pending' | 'Completed' | 'Cancelled';
}

const INITIAL_RESERVATIONS: MockReservationItem[] = [
  {
    id: 'res-001',
    prosumerNIC: '200345621321',
    stationId: 'CMB-NORTH-01',
    stationName: 'Colombo North Hub',
    timeWindow: 'Today, 14:00 - 15:00',
    energyAmountKWh: 45.0,
    actionType: 'Drop-off',
    status: 'Pending',
  },
  {
    id: 'res-002',
    prosumerNIC: '198522301982',
    stationId: 'CMB-CENTRAL-02',
    stationName: 'Fort Central Microgrid',
    timeWindow: 'Today, 14:30 - 15:30',
    energyAmountKWh: 30.0,
    actionType: 'Charge',
    status: 'Pending',
  },
  {
    id: 'res-003',
    prosumerNIC: '200324568412',
    stationId: 'KND-HILL-03',
    stationName: 'Kandy Hills Hub',
    timeWindow: 'Today, 15:00 - 16:00',
    energyAmountKWh: 60.0,
    actionType: 'Drop-off',
    status: 'Pending',
  },
  {
    id: 'res-004',
    prosumerNIC: '199109405621',
    stationId: 'CMB-NORTH-01',
    stationName: 'Colombo North Hub',
    timeWindow: 'Today, 11:00 - 12:00',
    energyAmountKWh: 50.0,
    actionType: 'Drop-off',
    status: 'Completed',
  },
  {
    id: 'res-005',
    prosumerNIC: '197820194821',
    stationId: 'CMB-WELL-12',
    stationName: 'Wellawatte Station',
    timeWindow: 'Today, 10:00 - 11:00',
    energyAmountKWh: 25.5,
    actionType: 'Charge',
    status: 'Completed',
  },
  {
    id: 'res-006',
    prosumerNIC: '8465651613',
    stationId: 'GAL-COAST-04',
    stationName: 'Galle Coastal Grid',
    timeWindow: 'Today, 09:30 - 10:30',
    energyAmountKWh: 40.0,
    actionType: 'Drop-off',
    status: 'Cancelled',
  },
];

interface MockStationItem {
  stationCode: string;
  name: string;
  location: string;
  capacityKWh: number;
  availableBatterySlots: number;
  totalBatterySlots: number;
  status: 'Active' | 'Maintenance' | 'Inactive';
  currentOutputKW: number;
}

const MOCK_STATIONS: MockStationItem[] = [
  {
    stationCode: 'CMB-NORTH-01',
    name: 'Colombo North Hub',
    location: 'Peliyagoda Substation',
    capacityKWh: 120,
    availableBatterySlots: 8,
    totalBatterySlots: 10,
    status: 'Active',
    currentOutputKW: 94.2,
  },
  {
    stationCode: 'CMB-CENTRAL-02',
    name: 'Fort Central Microgrid',
    location: 'Pettah Terminal Hub',
    capacityKWh: 150,
    availableBatterySlots: 10,
    totalBatterySlots: 12,
    status: 'Active',
    currentOutputKW: 118.5,
  },
  {
    stationCode: 'CMB-WELL-12',
    name: 'Wellawatte Station',
    location: 'Wellawatte Canal Road',
    capacityKWh: 80,
    availableBatterySlots: 6,
    totalBatterySlots: 6,
    status: 'Active',
    currentOutputKW: 52.0,
  },
  {
    stationCode: 'KND-HILL-03',
    name: 'Kandy Hills Hub',
    location: 'Peradeniya Ridge',
    capacityKWh: 90,
    availableBatterySlots: 4,
    totalBatterySlots: 8,
    status: 'Active',
    currentOutputKW: 71.4,
  },
  {
    stationCode: 'GAL-COAST-04',
    name: 'Galle Coastal Grid',
    location: 'Fort Ramparts Station',
    capacityKWh: 110,
    availableBatterySlots: 0,
    totalBatterySlots: 6,
    status: 'Maintenance',
    currentOutputKW: 0.0,
  },
];

export default function GridOperatorDashboardPage() {
  const { user } = useAuth();
  const [filterType, setFilterType] = useState<'all' | 'pending' | 'drop-off' | 'charge'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>('Just now');

  function handleRefresh() {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastRefreshed(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 600);
  }

  const filteredReservations = INITIAL_RESERVATIONS.filter((item) => {
    if (filterType === 'pending') return item.status === 'Pending';
    if (filterType === 'drop-off') return item.actionType === 'Drop-off';
    if (filterType === 'charge') return item.actionType === 'Charge';
    return true;
  });

  const totalSlotsAvailable = MOCK_STATIONS.reduce((sum, s) => sum + s.availableBatterySlots, 0);
  const totalSlotsCapacity = MOCK_STATIONS.reduce((sum, s) => sum + s.totalBatterySlots, 0);
  const activeStationsCount = MOCK_STATIONS.filter((s) => s.status === 'Active').length;

  return (
    <div className="space-y-8">
      {/* ── Top Header & Operational Telemetry Banner ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Grid Operations Command Center
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Online
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Welcome, <span className="font-semibold text-slate-800">{user?.fullName || 'Grid Officer'}</span>.
            Real-time telemetry, node battery capacities, and prosumer energy trading schedules.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs text-slate-400">Telemetry Sync</span>
            <span className="text-xs font-mono font-medium text-slate-600">{lastRefreshed}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="border-slate-300 bg-white shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Telemetry
          </Button>
        </div>
      </div>

      {/* ── Operational Status Strip ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Grid Frequency</p>
            <p className="text-sm font-bold font-mono text-slate-900">50.02 Hz <span className="text-xs font-normal text-emerald-600">(Optimal &plusmn;0.05)</span></p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Current Shift</p>
            <p className="text-sm font-bold text-slate-900">Day Operations <span className="text-xs font-normal text-slate-500">(08:00 - 18:00 UTC)</span></p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">FAT Architecture</p>
            <p className="text-sm font-bold text-slate-900">FAT Web API Enforcing <span className="text-xs font-normal text-amber-700 font-mono">12h/7d Rules</span></p>
          </div>
        </div>
      </div>

      {/* ── KPI Metrics Cards ── */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Active Grid Hubs */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Grid Hubs
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <MapPin className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <p className="text-3xl font-bold tracking-tight text-slate-900">{activeStationsCount}</p>
            <span className="text-sm text-slate-500">/ {MOCK_STATIONS.length} Online</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>1 Station in planned maintenance</span>
          </div>
        </div>

        {/* Battery Storage Availability */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Battery Storage Slots
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
              <BatteryCharging className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <p className="text-3xl font-bold tracking-tight text-sky-600">{totalSlotsAvailable}</p>
            <span className="text-sm text-slate-500">/ {totalSlotsCapacity} Available</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>{Math.round((totalSlotsAvailable / totalSlotsCapacity) * 100)}% Reserve capacity</span>
            <span className="font-mono text-slate-700 font-medium">{totalSlotsCapacity - totalSlotsAvailable} Occupied</span>
          </div>
        </div>

        {/* Energy Traded Today */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Energy Traded Today
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Zap className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <p className="text-3xl font-bold tracking-tight text-slate-900">2,450</p>
            <span className="text-sm font-semibold text-slate-600 font-mono">kWh</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>+14.2% trading vs yesterday</span>
          </div>
        </div>

        {/* Today's Reservations */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Reservations Today
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <CalendarCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <p className="text-3xl font-bold tracking-tight text-violet-700">14</p>
            <span className="text-sm text-slate-500">Pending Review</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>32 Completed</span>
            <span className="text-red-500">2 Cancelled</span>
          </div>
        </div>
      </div>

      {/* ── Quick Navigation Shortcuts to Operator Subsystems ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          to="/operator/reservations"
          className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
            <CalendarCheck className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-emerald-700">
                Reservation Dashboard
              </h3>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 group-hover:text-emerald-600 transition-all" />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Review, edit, and cancel prosumer energy appointments
            </p>
          </div>
        </Link>

        <Link
          to="/operator/stations"
          className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-sky-300 hover:shadow-md transition-all"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-colors">
            <CalendarOff className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-sky-700">
                Station Schedules
              </h3>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 group-hover:text-sky-600 transition-all" />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Override battery slots and schedule maintenance windows
            </p>
          </div>
        </Link>

        <Link
          to="/operator/slots"
          className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-amber-300 hover:shadow-md transition-all"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
            <Layers className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-amber-700">
                Slot Management
              </h3>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 group-hover:text-amber-600 transition-all" />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Create physical booking slots and manage node states
            </p>
          </div>
        </Link>
      </div>

      {/* ── Main Section: Today's Reservation Stream & Microgrid Node Health ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Table: Today's Scheduled Reservations (Takes 2 Columns) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 px-6 py-4 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-500" />
                  <h2 className="text-base font-semibold text-slate-900">Today's Appointment Queue</h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Prosumer scheduled energy drop-offs &amp; battery charging sessions
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
                {(['all', 'pending', 'drop-off', 'charge'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFilterType(type)}
                    className={`px-2.5 py-1 rounded-md capitalize transition-colors ${
                      filterType === type
                        ? 'bg-white text-slate-900 shadow-sm font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-700 border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-6 py-3">Prosumer NIC</th>
                    <th scope="col" className="px-6 py-3">Station Hub</th>
                    <th scope="col" className="px-6 py-3">Window</th>
                    <th scope="col" className="px-6 py-3 text-right">Energy</th>
                    <th scope="col" className="px-6 py-3">Type</th>
                    <th scope="col" className="px-6 py-3">Status</th>
                    <th scope="col" className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredReservations.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-3.5 font-mono text-xs font-semibold text-slate-900">
                        {item.prosumerNIC}
                      </td>
                      <td className="px-6 py-3.5">
                        <p className="font-mono text-xs text-slate-900 font-medium">{item.stationId}</p>
                        <p className="text-[11px] text-slate-500">{item.stationName}</p>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-xs text-slate-600">
                        {item.timeWindow}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-xs font-semibold text-slate-900">
                        {item.energyAmountKWh.toFixed(1)} kWh
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-mono font-medium ${
                            item.actionType === 'Drop-off'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-violet-50 text-violet-700 border-violet-200'
                          }`}
                        >
                          {item.actionType === 'Drop-off' ? (
                            <Zap className="h-3 w-3" />
                          ) : (
                            <BatteryCharging className="h-3 w-3" />
                          )}
                          {item.actionType}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                            item.status === 'Pending'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : item.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              item.status === 'Pending'
                                ? 'bg-amber-500 animate-pulse'
                                : item.status === 'Completed'
                                ? 'bg-emerald-500'
                                : 'bg-rose-400'
                            }`}
                          />
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <Link
                          to="/operator/reservations"
                          className="inline-flex items-center text-xs font-semibold text-emerald-600 hover:text-emerald-800"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Showing {filteredReservations.length} appointments
              </span>
              <Link
                to="/operator/reservations"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-800"
              >
                <span>Open Complete Reservation Dashboard</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Column 2: Microgrid Node Health & Rules (Takes 1 Column) */}
        <div className="space-y-6">
          {/* Microgrid Nodes Status Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  Microgrid Node Status
                </h3>
                <p className="text-xs text-slate-500">Real-time solar hub telemetry</p>
              </div>
              <Link
                to="/operator/stations"
                className="text-xs font-semibold text-sky-600 hover:text-sky-800"
              >
                Configure &rarr;
              </Link>
            </div>

            <div className="space-y-3">
              {MOCK_STATIONS.map((station) => (
                <div
                  key={station.stationCode}
                  className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {station.stationCode}
                        </span>
                        <span
                          className={`inline-flex items-center rounded px-1.5 py-0.2 text-[10px] font-semibold ${
                            station.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {station.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{station.name}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs font-semibold text-slate-800">
                        {station.currentOutputKW.toFixed(1)} kW
                      </span>
                      <p className="text-[10px] text-slate-400">output</p>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-600 pt-2 border-t border-slate-200/60">
                    <span>
                      Slots: <strong className="font-mono">{station.availableBatterySlots}</strong> / {station.totalBatterySlots} free
                    </span>
                    <span className="font-mono text-slate-500">{station.capacityKWh} kWh cap</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FAT Service Operational Rules Advisory */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>FAT Architecture Enforcement</span>
            </div>
            <ul className="text-xs text-amber-900/90 space-y-2 list-disc list-inside">
              <li>
                <strong>12-Hour Modification Rule:</strong> Cancellations and schedule modifications within 12 hours of the slot start are strictly blocked by the API.
              </li>
              <li>
                <strong>7-Day Lookahead:</strong> Prosumers may only book trading slots scheduled within a 7-day future window.
              </li>
              <li>
                <strong>Node Deactivation Guard:</strong> Hub stations with active or upcoming reservations cannot be deactivated.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
