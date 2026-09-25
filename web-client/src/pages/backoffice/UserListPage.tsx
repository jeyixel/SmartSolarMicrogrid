import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router';
import {
  Search,
  Filter,
  UserPlus,
  RefreshCw,
  Eye,
  RotateCcw,
  Users,
} from 'lucide-react';
import { userService } from '../../services/userService';
import {
  UserResponseDto,
  UserRole,
  AccountStatus,
  parseAccountStatus,
  parseUserRole,
} from '../../types/user';
import StatusBadge from '../../components/common/StatusBadge';
import RoleBadge from '../../components/common/RoleBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import AlertBanner from '../../components/common/AlertBanner';
import ConfirmDialog from '../../components/common/ConfirmDialog';

export default function UserListPage() {
  const [users, setUsers] = useState<UserResponseDto[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);

  const [searchInput, setSearchInput] = useState<string>('');
  const [appliedSearch, setAppliedSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Dialog state for Reactivation
  const [reactivateTarget, setReactivateTarget] = useState<UserResponseDto | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await userService.getUsers({
        search: appliedSearch,
        role: roleFilter !== '' ? roleFilter : undefined,
        status: statusFilter !== '' ? statusFilter : undefined,
        page,
        pageSize,
      });

      setUsers(response.items || []);
      setTotal(response.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user directory.');
      setUsers([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [appliedSearch, roleFilter, statusFilter, page, pageSize]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(searchInput.trim());
  }

  function handleResetFilters() {
    setSearchInput('');
    setAppliedSearch('');
    setRoleFilter('');
    setStatusFilter('');
    setPage(1);
  }

  async function handleConfirmReactivate() {
    if (!reactivateTarget) return;

    setIsSubmittingAction(true);
    try {
      await userService.reactivateProsumer(reactivateTarget.nic);
      setSuccessMessage(`Account for ${reactivateTarget.fullName} (${reactivateTarget.nic}) was reactivated successfully.`);
      setReactivateTarget(null);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate prosumer account.');
    } finally {
      setIsSubmittingAction(false);
    }
  }

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">User Directory</h1>
          <p className="mt-1 text-sm text-slate-500">
            View, search, and manage all registered accounts in the Smart Solar Microgrid.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fetchUsers()}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            title="Refresh user list"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <Link
            to="/backoffice/users/create"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <UserPlus className="h-4 w-4" />
            <span>Create Staff Account</span>
          </Link>
        </div>
      </div>

      {/* Alerts */}
      {successMessage && (
        <AlertBanner
          type="success"
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}
      {error && (
        <AlertBanner
          type="error"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {/* Search & Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Name, NIC, or Email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Roles</option>
              <option value="Backoffice">Backoffice</option>
              <option value="GridOperator">Grid Operator</option>
              <option value="Prosumer">Prosumer</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Deactivated">Deactivated</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Filter
            </button>
            {(appliedSearch || roleFilter || statusFilter) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Reset
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Users Data Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <LoadingSpinner message="Fetching user directory from server..." />
        ) : users.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title="No users match your criteria"
              description="Try adjusting your search terms or filters to find the account you are looking for."
              action={
                (appliedSearch || roleFilter || statusFilter) && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Clear all filters
                  </button>
                )
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-700 border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-6 py-3.5">User</th>
                    <th scope="col" className="px-6 py-3.5">NIC</th>
                    <th scope="col" className="px-6 py-3.5">Role</th>
                    <th scope="col" className="px-6 py-3.5">Status</th>
                    <th scope="col" className="px-6 py-3.5">Registered</th>
                    <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {users.map((userItem) => {
                    const statusVal = parseAccountStatus(userItem.accountStatus ?? userItem.status);
                    const roleVal = parseUserRole(userItem.role);
                    const isDeactivatedProsumer = roleVal === 2 && statusVal === 2;

                    return (
                      <tr key={userItem.id || userItem.nic} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">{userItem.fullName}</div>
                          <div className="text-xs text-slate-500">{userItem.email}</div>
                          {userItem.phoneNumber && (
                            <div className="text-[11px] text-slate-400">{userItem.phoneNumber}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs font-medium text-slate-700">
                          {userItem.nic}
                        </td>
                        <td className="px-6 py-4">
                          <RoleBadge role={userItem.role} />
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={userItem.accountStatus ?? userItem.status} />
                          {userItem.deactivationRequestedAt && statusVal === 1 && (
                            <span className="mt-1 block text-[11px] font-medium text-amber-600">
                              Deactivation Requested
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {new Date(userItem.createdAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isDeactivatedProsumer && (
                              <button
                                type="button"
                                onClick={() => setReactivateTarget(userItem)}
                                className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                                title="Reactivate this prosumer"
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>Reactivate</span>
                              </button>
                            )}
                            <Link
                              to={`/backoffice/users/${encodeURIComponent(userItem.nic)}`}
                              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                              <Eye className="h-3 w-3" />
                              <span>Details</span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 px-6 py-4 sm:flex-row">
              <div className="text-xs text-slate-500">
                Showing <span className="font-medium text-slate-900">{users.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to{' '}
                <span className="font-medium text-slate-900">
                  {Math.min(page * pageSize, total)}
                </span>{' '}
                of <span className="font-medium text-slate-900">{total}</span> accounts
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || isLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs font-medium text-slate-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages || isLoading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Reactivate Confirmation Modal */}
      <ConfirmDialog
        isOpen={!!reactivateTarget}
        title="Reactivate Prosumer Account"
        description={`Are you sure you want to reactivate the prosumer account for ${reactivateTarget?.fullName} (NIC: ${reactivateTarget?.nic})? This will restore their access to solar microgrid services.`}
        confirmText="Reactivate Account"
        variant="success"
        isLoading={isSubmittingAction}
        onConfirm={handleConfirmReactivate}
        onCancel={() => setReactivateTarget(null)}
      />
    </div>
  );
}
