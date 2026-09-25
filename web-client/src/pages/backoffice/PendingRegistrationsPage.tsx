import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router';
import {
  UserCheck,
  RefreshCw,
  Eye,
  CheckCircle2,
  Inbox,
  Clock,
  Info,
} from 'lucide-react';
import { userService } from '../../services/userService';
import { UserResponseDto } from '../../types/user';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import AlertBanner from '../../components/common/AlertBanner';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import StatusBadge from '../../components/common/StatusBadge';

export default function PendingRegistrationsPage() {
  const [pendingUsers, setPendingUsers] = useState<UserResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Target prosumer for activation dialog
  const [activateTarget, setActivateTarget] = useState<UserResponseDto | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchPending = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await userService.getPendingRegistrations();
      setPendingUsers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending registrations.');
      setPendingUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  async function handleConfirmActivate() {
    if (!activateTarget) return;

    setIsSubmitting(true);
    try {
      await userService.activateProsumer(activateTarget.nic);
      setSuccessMessage(
        `Prosumer account for ${activateTarget.fullName} (${activateTarget.nic}) has been activated successfully.`
      );
      setActivateTarget(null);
      await fetchPending();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate prosumer.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Pending Registrations
            </h1>
            <p className="text-sm text-slate-500">
              Review and activate newly registered prosumer accounts awaiting approval.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchPending()}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
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

      {/* Backend endpoint notice */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50/70 p-3.5 text-xs text-blue-800">
        <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
        <div>
          <span>
            Prosumers register via self-service and remain in <strong>Pending</strong> status until verified. Activating grants full system and microgrid access.
          </span>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <LoadingSpinner message="Fetching pending registrations..." />
        ) : pendingUsers.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<Inbox className="h-8 w-8 text-emerald-500" />}
              title="No pending registrations"
              description="All prosumer accounts are up to date. There are currently no applications awaiting backoffice review."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-700 border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-6 py-3.5">Prosumer</th>
                  <th scope="col" className="px-6 py-3.5">NIC</th>
                  <th scope="col" className="px-6 py-3.5">Contact & Location</th>
                  <th scope="col" className="px-6 py-3.5">Submitted On</th>
                  <th scope="col" className="px-6 py-3.5">Status</th>
                  <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {pendingUsers.map((userItem) => (
                  <tr key={userItem.id || userItem.nic} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{userItem.fullName}</div>
                      <div className="text-xs text-slate-500">{userItem.email}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-medium text-slate-700">
                      {userItem.nic}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      <div>{userItem.phoneNumber || '—'}</div>
                      <div className="truncate max-w-xs text-slate-400">{userItem.address || '—'}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>
                          {new Date(userItem.createdAt).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={userItem.accountStatus ?? userItem.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/backoffice/users/${encodeURIComponent(userItem.nic)}`}
                          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Eye className="h-3 w-3" />
                          <span>View Details</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => setActivateTarget(userItem)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Activate</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!activateTarget}
        title="Activate Prosumer Account"
        description={`Are you sure you want to approve and activate the account for ${activateTarget?.fullName} (NIC: ${activateTarget?.nic})? This will immediately grant the prosumer active access.`}
        confirmText="Activate Account"
        variant="success"
        isLoading={isSubmitting}
        onConfirm={handleConfirmActivate}
        onCancel={() => setActivateTarget(null)}
      />
    </div>
  );
}
