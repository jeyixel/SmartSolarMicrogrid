import React, { useEffect, useState, useCallback, type FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import {
  ArrowLeft,
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Shield,
  Edit,
  CheckCircle2,
  RotateCcw,
  UserX,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { userService } from '../../services/userService';
import {
  UserResponseDto,
  UpdateUserProfileRequestDto,
  parseAccountStatus,
  parseUserRole,
} from '../../types/user';
import StatusBadge from '../../components/common/StatusBadge';
import RoleBadge from '../../components/common/RoleBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import AlertBanner from '../../components/common/AlertBanner';
import ConfirmDialog from '../../components/common/ConfirmDialog';

export default function UserDetailsPage() {
  const { nic } = useParams<{ nic: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<UserResponseDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit Profile modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editFormData, setEditFormData] = useState<UpdateUserProfileRequestDto>({
    fullName: '',
    email: '',
    phoneNumber: '',
    address: '',
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);

  // Lifecycle Action Dialog states
  const [confirmAction, setConfirmAction] = useState<{
    type: 'activate' | 'reactivate' | 'approveDeactivation' | 'rejectDeactivation';
    title: string;
    description: string;
    confirmText: string;
    variant: 'primary' | 'danger' | 'warning' | 'success';
  } | null>(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);

  const fetchUserDetails = useCallback(async () => {
    if (!nic) {
      setError('User NIC is missing from URL.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await userService.getUserByNic(nic);
      setUser(data);
      setEditFormData({
        fullName: data.fullName || '',
        email: data.email || '',
        phoneNumber: data.phoneNumber || '',
        address: data.address || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve user details.');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [nic]);

  useEffect(() => {
    fetchUserDetails();
  }, [fetchUserDetails]);

  function handleEditChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
    setEditErrors((prev) => ({ ...prev, [name]: '' }));
  }

  function validateEditForm(): boolean {
    const errors: Record<string, string> = {};
    if (!editFormData.fullName.trim() || editFormData.fullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters.';
    }
    if (!editFormData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editFormData.email.trim())) {
      errors.email = 'A valid email is required.';
    }
    if (!editFormData.phoneNumber.trim() || !/^0[0-9]{9}$/.test(editFormData.phoneNumber.trim())) {
      errors.phoneNumber = 'Phone number must be 10 digits starting with 0.';
    }
    if (!editFormData.address.trim() || editFormData.address.trim().length < 5) {
      errors.address = 'Address must be at least 5 characters.';
    }

    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!validateEditForm() || !nic) return;

    setIsSavingProfile(true);
    setError(null);

    try {
      const updated = await userService.updateUser(nic, {
        fullName: editFormData.fullName.trim(),
        email: editFormData.email.trim(),
        phoneNumber: editFormData.phoneNumber.trim(),
        address: editFormData.address.trim(),
      });
      setUser(updated);
      setIsEditModalOpen(false);
      setSuccessMessage('User profile updated successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleExecuteAction() {
    if (!confirmAction || !nic) return;

    setIsSubmittingAction(true);
    setError(null);

    try {
      switch (confirmAction.type) {
        case 'activate':
          await userService.activateProsumer(nic);
          setSuccessMessage(`Account activated successfully.`);
          break;
        case 'reactivate':
          await userService.reactivateProsumer(nic);
          setSuccessMessage(`Account reactivated successfully.`);
          break;
        case 'approveDeactivation':
          await userService.approveDeactivation(nic);
          setSuccessMessage(`Deactivation request approved. Account is now deactivated.`);
          break;
        case 'rejectDeactivation':
          await userService.rejectDeactivation(nic);
          setSuccessMessage(`Deactivation request rejected. Account remains active.`);
          break;
      }
      setConfirmAction(null);
      await fetchUserDetails();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
      setConfirmAction(null);
    } finally {
      setIsSubmittingAction(false);
    }
  }

  if (isLoading) {
    return <LoadingSpinner message="Fetching user details..." />;
  }

  if (!user && error) {
    return (
      <div className="space-y-6">
        <Link
          to="/backoffice/users"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to User Directory</span>
        </Link>
        <AlertBanner type="error" message={error} />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const statusVal = parseAccountStatus(user.accountStatus ?? user.status);
  const roleVal = parseUserRole(user.role);
  const isProsumer = roleVal === 2;

  return (
    <div className="space-y-6">
      {/* Top breadcrumb & back button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/backoffice/users"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to User Directory</span>
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {user.fullName}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-slate-600">NIC: {user.nic}</span>
            <span className="text-slate-300">•</span>
            <RoleBadge role={user.role} />
            <StatusBadge status={user.accountStatus ?? user.status} />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Edit className="h-3.5 w-3.5" />
            <span>Edit Profile</span>
          </button>

          {/* Pending Prosumer: Activate Action */}
          {isProsumer && statusVal === 0 && (
            <button
              type="button"
              onClick={() =>
                setConfirmAction({
                  type: 'activate',
                  title: 'Activate Prosumer Account',
                  description: `Are you sure you want to activate the account for ${user.fullName} (NIC: ${user.nic})?`,
                  confirmText: 'Activate Account',
                  variant: 'success',
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Activate Account</span>
            </button>
          )}

          {/* Deactivated Prosumer: Reactivate Action */}
          {isProsumer && statusVal === 2 && (
            <button
              type="button"
              onClick={() =>
                setConfirmAction({
                  type: 'reactivate',
                  title: 'Reactivate Prosumer Account',
                  description: `Are you sure you want to reactivate the account for ${user.fullName} (NIC: ${user.nic})? This will restore active microgrid services.`,
                  confirmText: 'Reactivate Account',
                  variant: 'success',
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reactivate Account</span>
            </button>
          )}

          {/* Active Prosumer with Deactivation Request */}
          {isProsumer && statusVal === 1 && user.deactivationRequestedAt && (
            <>
              <button
                type="button"
                onClick={() =>
                  setConfirmAction({
                    type: 'rejectDeactivation',
                    title: 'Reject Deactivation Request',
                    description: `Reject the deactivation request for ${user.fullName}? Account will remain active.`,
                    confirmText: 'Reject Request',
                    variant: 'warning',
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <XCircle className="h-3.5 w-3.5 text-slate-500" />
                <span>Reject Deactivation</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setConfirmAction({
                    type: 'approveDeactivation',
                    title: 'Approve Account Deactivation',
                    description: `Approve deactivation for ${user.fullName} (NIC: ${user.nic})? Account will be deactivated immediately.`,
                    confirmText: 'Approve & Deactivate',
                    variant: 'danger',
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-medium text-white shadow-sm hover:bg-rose-700"
              >
                <UserX className="h-3.5 w-3.5" />
                <span>Approve Deactivation</span>
              </button>
            </>
          )}
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

      {/* Deactivation Banner */}
      {user.deactivationRequestedAt && statusVal === 1 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-semibold">Deactivation Request Pending:</span> This prosumer requested account deactivation on{' '}
            <strong>
              {new Date(user.deactivationRequestedAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </strong>
            . Use the action buttons above to approve or reject the request.
          </div>
        </div>
      )}

      {/* Main Grid: Profile Details and Audit History */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 cols: Profile Information */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <UserIcon className="h-4 w-4 text-blue-600" />
              <h2 className="text-base font-semibold text-slate-900">Personal & Contact Profile</h2>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-500">Full Legal Name</dt>
                <dd className="mt-1 font-medium text-slate-900">{user.fullName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">National Identity Card (NIC)</dt>
                <dd className="mt-1 font-mono font-medium text-slate-900">{user.nic}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Email Address</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-slate-800">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span>{user.email}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Phone Number</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-slate-800">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>{user.phoneNumber || 'Not provided'}</span>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500">Physical Address / Installation Site</dt>
                <dd className="mt-1 flex items-start gap-1.5 text-slate-800">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{user.address || 'Not provided'}</span>
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Shield className="h-4 w-4 text-blue-600" />
              <h2 className="text-base font-semibold text-slate-900">Account Authorization</h2>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-500">Assigned Role</dt>
                <dd className="mt-1.5">
                  <RoleBadge role={user.role} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Current Status</dt>
                <dd className="mt-1.5">
                  <StatusBadge status={user.accountStatus ?? user.status} />
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Right 1 col: Audit & Lifecycle Log */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Clock className="h-4 w-4 text-slate-600" />
              <h2 className="text-base font-semibold text-slate-900">Audit & Lifecycle</h2>
            </div>

            <ul className="mt-4 space-y-4 text-xs">
              <li className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800">Registered On</span>
                  <p className="text-slate-500">
                    {new Date(user.createdAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
              </li>

              {user.updatedAt && (
                <li className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800">Last Profile Update</span>
                    <p className="text-slate-500">
                      {new Date(user.updatedAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>
                </li>
              )}

              {user.deactivationRequestedAt && (
                <li className="flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-amber-800">Deactivation Requested</span>
                    <p className="text-amber-700">
                      {new Date(user.deactivationRequestedAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>
                </li>
              )}

              {user.deactivatedAt && (
                <li className="flex items-start gap-3">
                  <UserX className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-rose-800">Deactivated On</span>
                    <p className="text-slate-500">
                      {new Date(user.deactivatedAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                    {user.deactivatedBy && (
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        By Staff: {user.deactivatedBy}
                      </p>
                    )}
                  </div>
                </li>
              )}

              {user.reactivatedAt && (
                <li className="flex items-start gap-3">
                  <RotateCcw className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-emerald-800">Reactivated On</span>
                    <p className="text-slate-500">
                      {new Date(user.reactivatedAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                    {user.reactivatedBy && (
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        By Staff: {user.reactivatedBy}
                      </p>
                    )}
                  </div>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-900">Edit User Profile</h2>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700">Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  value={editFormData.fullName}
                  onChange={handleEditChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {editErrors.fullName && (
                  <p className="mt-1 text-xs text-rose-600">{editErrors.fullName}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={editFormData.email}
                  onChange={handleEditChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {editErrors.email && (
                  <p className="mt-1 text-xs text-rose-600">{editErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Phone Number</label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={editFormData.phoneNumber}
                  onChange={handleEditChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {editErrors.phoneNumber && (
                  <p className="mt-1 text-xs text-rose-600">{editErrors.phoneNumber}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Address / Location</label>
                <textarea
                  name="address"
                  rows={3}
                  value={editFormData.address}
                  onChange={handleEditChange}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {editErrors.address && (
                  <p className="mt-1 text-xs text-rose-600">{editErrors.address}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSavingProfile}
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSavingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Action Modal */}
      {confirmAction && (
        <ConfirmDialog
          isOpen={!!confirmAction}
          title={confirmAction.title}
          description={confirmAction.description}
          confirmText={confirmAction.confirmText}
          variant={confirmAction.variant}
          isLoading={isSubmittingAction}
          onConfirm={handleExecuteAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
