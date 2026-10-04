import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchReservations,
  cancelReservation,
  approveReservation,
  rejectReservation,
  EnergyReservation,
} from '../../lib/api';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { toast } from '../../hooks/useToast';
import { ReservationModal } from './ReservationModal';
import {
  PlusCircle,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';

const STATUS_STYLES: Record<string, { chip: string; dot: string }> = {
  Pending:   { chip: 'bg-amber-50 text-amber-700 border-amber-200',   dot: 'bg-amber-500 animate-pulse' },
  Approved:  { chip: 'bg-blue-50 text-blue-700 border-blue-200',      dot: 'bg-blue-500' },
  CheckedIn: { chip: 'bg-indigo-50 text-indigo-700 border-indigo-200',dot: 'bg-indigo-500' },
  Completed: { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  Cancelled: { chip: 'bg-red-50 text-red-700 border-red-200',         dot: 'bg-red-400' },
  Rejected:  { chip: 'bg-red-50 text-red-900 border-red-300',         dot: 'bg-red-600' },
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const s = STATUS_STYLES[status] ?? {
    chip: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-label-sm uppercase font-mono ${s.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {status}
    </span>
  );
};

const KpiChip: React.FC<{ label: string; count: number; dotClass: string }> = ({
  label, count, dotClass,
}) => (
  <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-2">
    <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dotClass}`} />
    <span className="text-telemetry-md text-slate-900">{count}</span>
    <span className="text-label-sm text-slate-500 uppercase">{label}</span>
  </div>
);

export const ReservationDashboard: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id || '';
  const [reservations, setReservations] = useState<EnergyReservation[]>([]);
  const [loading, setLoading]        = useState(true);
  const [modalOpen, setModalOpen]    = useState(false);
  const [editTarget, setEditTarget]  = useState<EnergyReservation | undefined>();
  const [cancelling, setCancelling]  = useState<string | null>(null);
  const [approving, setApproving]    = useState<string | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTarget, setRejectTarget]       = useState<EnergyReservation | null>(null);
  const [rejectReason, setRejectReason]       = useState('');
  const [rejecting, setRejecting]             = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchReservations();
      setReservations(data);
    } catch (err: any) {
      toast({
        title: 'Failed to load reservations',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleApprove = async (r: EnergyReservation) => {
    if (!window.confirm(`Approve reservation ${r.reservationCode || r.id} for ${r.prosumerName || r.prosumerNIC}? This will confirm the booking and activate their QR pass.`)) return;
    setApproving(r.id);
    try {
      await approveReservation(r.id, userId);
      toast({
        title: 'Reservation Approved',
        description: `Reservation ${r.reservationCode || r.id} is now approved.`,
        variant: 'default',
      });
      loadData();
    } catch (err: any) {
      toast({
        title: 'Approval Failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setApproving(null);
    }
  };

  const openReject = (r: EnergyReservation) => {
    setRejectTarget(r);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      await rejectReservation(rejectTarget.id, rejectReason.trim(), userId);
      toast({
        title: 'Reservation Rejected',
        description: `Reservation ${rejectTarget.reservationCode || rejectTarget.id} was rejected. Slot capacity has been released.`,
        variant: 'default',
      });
      setRejectModalOpen(false);
      setRejectTarget(null);
      loadData();
    } catch (err: any) {
      toast({
        title: 'Rejection Failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setRejecting(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('Cancel this reservation? The physical slot will be released back to Available.')) return;
    setCancelling(id);
    try {
      await cancelReservation(id, userId);
      toast({ title: 'Reservation cancelled', description: 'The slot has been released.', variant: 'default' });
      loadData();
    } catch (err: any) {
      const is12Hour = (err as any).rule === '12HourRule';
      toast({
        title: is12Hour ? '12-Hour Rule — Cancellation Blocked' : 'Cancellation Failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setCancelling(null);
    }
  };

  const openEdit = (r: EnergyReservation) => {
    setEditTarget(r);
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditTarget(undefined);
    setModalOpen(true);
  };

  const handleModalSuccess = () => {
    setModalOpen(false);
    setEditTarget(undefined);
    loadData();
  };

  // Counts for KPI row
  const pending   = reservations.filter(r => r.status === 'Pending').length;
  const approved  = reservations.filter(r => r.status === 'Approved').length;
  const completed = reservations.filter(r => r.status === 'Completed').length;
  const cancelled = reservations.filter(r => r.status === 'Cancelled' || r.status === 'Rejected').length;

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-headline-lg text-slate-900">Reservation Dashboard</h2>
          <p className="text-body-sm text-muted-foreground mt-0.5">
            Monitor and manage all prosumer energy trading appointments.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
            New Reservation
          </Button>
        </div>
      </div>

      {/* KPI summary row */}
      <div className="flex gap-3 flex-wrap">
        <KpiChip label="Total"     count={reservations.length} dotClass="bg-slate-400" />
        <KpiChip label="Pending"   count={pending}         dotClass="bg-amber-500 animate-pulse" />
        <KpiChip label="Approved"  count={approved}        dotClass="bg-blue-500" />
        <KpiChip label="Completed" count={completed}       dotClass="bg-emerald-500" />
        <KpiChip label="Cancelled / Rejected" count={cancelled} dotClass="bg-red-400" />
      </div>

      {/* Data table */}
      <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-none">
        <Table>
          <TableHeader>
            <TableRow className="h-7">
              <TableHead>Res Code</TableHead>
              <TableHead>Prosumer NIC</TableHead>
              <TableHead>Station</TableHead>
              <TableHead>Date &amp; Time Window</TableHead>
              <TableHead className="text-right">Requested Energy</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right pr-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-body-sm">Loading reservations…</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : reservations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <Clock className="h-10 w-10 text-slate-200" />
                    <p className="text-body-md text-muted-foreground">No reservations found.</p>
                    <Button size="sm" variant="outline" onClick={openCreate}>
                      <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                      Create the first reservation
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              reservations.map(r => (
                <TableRow key={r.id}>
                  {/* Reservation Code */}
                  <TableCell>
                    <span className="font-mono text-xs text-slate-900">{r.reservationCode}</span>
                  </TableCell>
                  
                  {/* Prosumer NIC */}
                  <TableCell>
                    <span className="font-mono text-xs text-slate-900">{r.prosumerNIC}</span>
                  </TableCell>

                  {/* Station */}
                  <TableCell>
                      <div>
                        <p className="font-mono text-xs text-slate-900">{r.stationId}</p>
                        <p className="text-body-sm text-muted-foreground">{r.stationName}</p>
                      </div>
                  </TableCell>

                  {/* Date & Time */}
                  <TableCell>
                      <div className="font-mono text-xs">
                        <p className="text-slate-900">
                          {new Date(r.slotStartTime).toLocaleString('en-GB', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </p>
                        <p className="text-muted-foreground">
                          → {new Date(r.slotEndTime).toLocaleString('en-GB', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </p>
                      </div>
                  </TableCell>

                  {/* Energy */}
                  <TableCell className="text-right">
                    <span className="font-mono text-xs text-slate-900">
                      {r.requestedKWh ? r.requestedKWh.toFixed(1) + ' kWh' : '—'}
                    </span>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right pr-4">
                    {r.status === 'Pending' ? (
                      <div className="flex justify-end items-center gap-1.5 flex-wrap">
                        <Button
                          size="sm"
                          className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-none font-medium"
                          onClick={() => handleApprove(r)}
                          disabled={approving === r.id || cancelling === r.id || rejecting}
                        >
                          {approving === r.id ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          )}
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 font-medium"
                          onClick={() => openReject(r)}
                          disabled={approving === r.id || cancelling === r.id || rejecting}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs px-2.5"
                          onClick={() => openEdit(r)}
                          disabled={approving === r.id || cancelling === r.id || rejecting}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 text-xs px-2.5"
                          onClick={() => handleCancel(r.id)}
                          disabled={cancelling === r.id || approving === r.id || rejecting}
                        >
                          {cancelling === r.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            'Cancel'
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex justify-end items-center gap-1.5 font-mono text-xs">
                        {r.status === 'Approved' ? (
                          <span className="inline-flex items-center text-blue-600 font-medium gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                            Approved
                          </span>
                        ) : r.status === 'Completed' ? (
                          <span className="inline-flex items-center text-emerald-600 font-medium gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            Completed
                          </span>
                        ) : r.status === 'Rejected' ? (
                          <span className="inline-flex items-center text-red-600 font-medium gap-1" title={r.cancellationReason || 'Rejected'}>
                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-slate-400 gap-1">
                            <XCircle className="h-3.5 w-3.5 text-slate-300" />
                            Cancelled
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Reservation create/edit modal */}
      <ReservationModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(undefined); }}
        onSuccess={handleModalSuccess}
        editReservation={editTarget}
      />

      {/* Rejection Modal Dialog */}
      <Dialog
        open={rejectModalOpen}
        onClose={() => { if (!rejecting) setRejectModalOpen(false); }}
        title="Reject Reservation"
        description={
          rejectTarget
            ? `Provide a reason for rejecting reservation ${rejectTarget.reservationCode || rejectTarget.id}. Physical slot capacity will be restored immediately.`
            : 'Provide a reason for rejection.'
        }
      >
        <form onSubmit={handleConfirmReject} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="rejection-reason" className="text-label-sm text-slate-700 font-medium">
              Rejection Reason
            </label>
            <Input
              id="rejection-reason"
              placeholder="e.g. Station capacity constrained / Incompatible charging protocol"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              required
              className="w-full text-body-sm"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              This message will be attached to the reservation audit trail for the prosumer.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRejectModalOpen(false)}
              disabled={rejecting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={rejecting}
            >
              {rejecting ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                  Rejecting…
                </>
              ) : (
                'Confirm Rejection'
              )}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
