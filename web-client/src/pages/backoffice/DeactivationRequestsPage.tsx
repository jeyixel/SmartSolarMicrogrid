import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router';
import {
  UserX,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Inbox,
  AlertTriangle,
} from 'lucide-react';
import { userService } from '../../services/userService';
import { UserResponseDto } from '../../types/user';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import AlertBanner from '../../components/common/AlertBanner';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import StatusBadge from '../../components/common/StatusBadge';

export default function DeactivationRequestsPage() {
  const [requests, setRequests] = useState<UserResponseDto[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal dialog states
  const [actionTarget, setActionTarget] = useState<UserResponseDto | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Use server-side filter and pagination
      const response = await userService.getUsers({
        role: 'Prosumer',
        status: 'Active',
        deactivationRequestsOnly: true,
        page,
        pageSize,
      });
      setRequests(response.items || []);
      setTotal(response.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch deactivation requests.');
      setRequests([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  async function handleConfirmAction() {
    if (!actionTarget || !actionType) return;

    setIsSubmitting(true);
    try {
      if (actionType === 'approve') {
        await userService.approveDeactivation(actionTarget.nic);
        setSuccessMessage(
          `Deactivation request approved for ${actionTarget.fullName} (${actionTarget.nic}). Account has been marked as Deactivated.`
        );
      } else {
        await userService.rejectDeactivation(actionTarget.nic);
        setSuccessMessage(
          `Deactivation request rejected for ${actionTarget.fullName} (${actionTarget.nic}). Account remains Active.`
        );
      }
      setActionTarget(null);
      setActionType(null);
      await fetchRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${actionType} deactivation request.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
            <UserX className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Deactivation Requests
            </h1>
            <p className="text-sm text-slate-500">
              Review and act on prosumer requests to deactivate their solar microgrid accounts.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchRequests()}
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

      {/* Info notice */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
        <div>
          <span>
            <strong>Note:</strong> Approving deactivation will revoke prosumer access and disconnect their smart meter tracking. You can reject the request to retain their active status, or reactivate the account later if needed.
          </span>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <LoadingSpinner message="Loading deactivation requests from server..." />
        ) : requests.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<Inbox className="h-8 w-8 text-slate-400" />}
              title="No pending deactivation requests"
              description="There are currently no prosumers who have submitted requests to deactivate their accounts."
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-700 border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-6 py-3.5">Prosumer</th>
                    <th scope="col" className="px-6 py-3.5">NIC</th>
                    <th scope="col" className="px-6 py-3.5">Contact Details</th>
                    <th scope="col" className="px-6 py-3.5">Request Date</th>
                    <th scope="col" className="px-6 py-3.5">Status</th>
                    <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {requests.map((userItem) => (
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
                      <td className="px-6 py-4 text-xs text-slate-700 font-medium">
                        {userItem.deactivationRequestedAt ? (
                          <div className="flex items-center gap-1.5 text-rose-700">
                            <Clock className="h-3.5 w-3.5" />
                            <span>
                              {new Date(userItem.deactivationRequestedAt).toLocaleString(undefined, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </span>
                          </div>
                        ) : (
                          '—'
                        )}
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
                            <span>Details</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setActionTarget(userItem);
                              setActionType('reject');
                            }}
                            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            title="Reject deactivation request"
                          >
                            <XCircle className="h-3 w-3 text-slate-500" />
                            <span>Reject</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActionTarget(userItem);
                              setActionType('approve');
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-rose-700"
                            title="Approve and deactivate account"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span>Approve</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 px-6 py-4 sm:flex-row">
              <div className="text-xs text-slate-500">
                Showing <span className="font-medium text-slate-900">{requests.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to{' '}
                <span className="font-medium text-slate-900">
                  {Math.min(page * pageSize, total)}
                </span>{' '}
                of <span className="font-medium text-slate-900">{total}</span> requests
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

      {/* Confirmation Modal */}
      <ConfirmDialog
        isOpen={!!actionTarget && !!actionType}
        title={
          actionType === 'approve'
            ? 'Approve Account Deactivation'
            : 'Reject Deactivation Request'
        }
        description={
          actionType === 'approve'
            ? `Are you sure you want to APPROVE the deactivation for ${actionTarget?.fullName} (NIC: ${actionTarget?.nic})? This will immediately deactivate their account.`
            : `Are you sure you want to REJECT the deactivation request for ${actionTarget?.fullName} (NIC: ${actionTarget?.nic})? The account will remain Active and the request flag will be cleared.`
        }
        confirmText={actionType === 'approve' ? 'Approve & Deactivate' : 'Reject Request'}
        variant={actionType === 'approve' ? 'danger' : 'warning'}
        isLoading={isSubmitting}
        onConfirm={handleConfirmAction}
        onCancel={() => {
          setActionTarget(null);
          setActionType(null);
        }}
      />
    </div>
  );
}
