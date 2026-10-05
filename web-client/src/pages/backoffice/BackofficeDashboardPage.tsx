import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  Users,
  UserCheck,
  UserX,
  UserPlus,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { userService } from '../../services/userService';
import { UserResponseDto, parseAccountStatus } from '../../types/user';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/common/StatusBadge';
import RoleBadge from '../../components/common/RoleBadge';
import AlertBanner from '../../components/common/AlertBanner';

export default function BackofficeDashboardPage() {
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [activeUsersCount, setActiveUsersCount] = useState<number>(0);
  const [pendingUsers, setPendingUsers] = useState<UserResponseDto[]>([]);
  const [deactivationRequests, setDeactivationRequests] = useState<UserResponseDto[]>([]);
  const [recentUsers, setRecentUsers] = useState<UserResponseDto[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboardData() {
    setIsLoading(true);
    setError(null);

    try {
      const [allUsersRes, pendingRes, deactivationRes, activeUsersRes] = await Promise.all([
        userService.getUsers({ page: 1, pageSize: 5 }),
        userService.getPendingRegistrations(),
        userService.getDeactivationRequests(),
        userService.getUsers({ status: 'Active', page: 1, pageSize: 1 }),
      ]);

      setTotalUsers(allUsersRes.total || 0);
      setRecentUsers(allUsersRes.items || []);
      setPendingUsers(pendingRes || []);
      setDeactivationRequests(deactivationRes || []);
      setActiveUsersCount(activeUsersRes.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard metrics.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Backoffice Management Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Overview of user accounts, pending approvals, and system administrative tasks.
          </p>
        </div>
        <button
          type="button"
          onClick={loadDashboardData}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Overview</span>
        </button>
      </div>

      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} />}

      {isLoading ? (
        <LoadingSpinner message="Aggregating dashboard overview..." />
      ) : (
        <>
          {/* KPI Metrics Cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Users */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Accounts
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Users className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{totalUsers}</p>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                <span>Across all system roles</span>
              </div>
            </div>

            {/* Active Users */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Active Users
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-bold tracking-tight text-emerald-600">{activeUsersCount}</p>
              <p className="mt-2 text-xs text-slate-500">Fully verified & enabled</p>
            </div>

            {/* Pending Registrations */}
            <Link
              to="/backoffice/users/pending"
              className="group rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm transition-all hover:bg-amber-50 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
                  Pending Approvals
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <UserCheck className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-bold tracking-tight text-amber-900">
                {pendingUsers.length}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-amber-700">
                <span>Awaiting backoffice review</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>

            {/* Deactivation Requests */}
            <Link
              to="/backoffice/users/deactivation-requests"
              className="group rounded-xl border border-rose-200 bg-rose-50/50 p-5 shadow-sm transition-all hover:bg-rose-50 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-800">
                  Deactivation Requests
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
                  <UserX className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-bold tracking-tight text-rose-900">
                {deactivationRequests.length}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-rose-700">
                <span>Requested by prosumers</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </div>

          {/* Quick Action Navigation Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Link
              to="/backoffice/users/create"
              className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <UserPlus className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Create Staff Account</h3>
                <p className="text-xs text-slate-500">Add Backoffice or Grid Operator users</p>
              </div>
            </Link>

            <Link
              to="/backoffice/users/pending"
              className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-amber-300 hover:shadow-md transition-all"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <UserCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Review Registrations</h3>
                <p className="text-xs text-slate-500">
                  {pendingUsers.length} application{pendingUsers.length === 1 ? '' : 's'} pending
                </p>
              </div>
            </Link>

            <Link
              to="/backoffice/users"
              className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 hover:shadow-md transition-all"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Browse Directory</h3>
                <p className="text-xs text-slate-500">Search and filter all system users</p>
              </div>
            </Link>
          </div>

          {/* Recent Accounts Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-500" />
                <h2 className="text-base font-semibold text-slate-900">Recent Users</h2>
              </div>
              <Link
                to="/backoffice/users"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                View full directory &rarr;
              </Link>
            </div>

            {recentUsers.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No recent users found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-700 border-b border-slate-200">
                    <tr>
                      <th scope="col" className="px-6 py-3">Name</th>
                      <th scope="col" className="px-6 py-3">NIC</th>
                      <th scope="col" className="px-6 py-3">Role</th>
                      <th scope="col" className="px-6 py-3">Status</th>
                      <th scope="col" className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {recentUsers.map((item) => (
                      <tr key={item.id || item.nic} className="hover:bg-slate-50/80">
                        <td className="px-6 py-3 font-medium text-slate-900">{item.fullName}</td>
                        <td className="px-6 py-3 font-mono text-xs text-slate-600">{item.nic}</td>
                        <td className="px-6 py-3">
                          <RoleBadge role={item.role} />
                        </td>
                        <td className="px-6 py-3">
                          <StatusBadge status={item.accountStatus ?? item.status} />
                        </td>
                        <td className="px-6 py-3 text-right">
                          <Link
                            to={`/backoffice/users/${encodeURIComponent(item.nic)}`}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800"
                          >
                            Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
