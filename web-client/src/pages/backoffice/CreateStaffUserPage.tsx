import React, { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { UserPlus, ArrowLeft, Shield, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';
import { userService } from '../../services/userService';
import { CreateStaffUserRequestDto } from '../../types/user';
import AlertBanner from '../../components/common/AlertBanner';
import ConfirmDialog from '../../components/common/ConfirmDialog';

export default function CreateStaffUserPage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState<CreateStaffUserRequestDto>({
    fullName: '',
    nic: '',
    email: '',
    phoneNumber: '',
    role: 'Backoffice',
    password: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [createdUserSuccess, setCreatedUserSuccess] = useState<{
    fullName: string;
    nic: string;
    role: string;
  } | null>(null);

  const nicRegex = /^(?:[0-9]{12}|[0-9]{9}[VvXx])$/;
  const phoneRegex = /^0[0-9]{9}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validateField(name: string, value: string): string {
    switch (name) {
      case 'fullName':
        if (!value.trim()) return 'Full name is required.';
        if (value.trim().length < 2) return 'Full name must be at least 2 characters.';
        if (value.trim().length > 100) return 'Full name cannot exceed 100 characters.';
        return '';
      case 'nic':
        if (!value.trim()) return 'NIC is required.';
        if (!nicRegex.test(value.trim())) {
          return 'Enter a valid NIC (e.g., 199012345678 or 901234567V).';
        }
        return '';
      case 'email':
        if (!value.trim()) return 'Email address is required.';
        if (!emailRegex.test(value.trim())) return 'Enter a valid email address.';
        return '';
      case 'phoneNumber':
        if (!value.trim()) return 'Phone number is required.';
        if (!phoneRegex.test(value.trim())) {
          return 'Enter a valid 10-digit phone number starting with 0 (e.g., 0712345678).';
        }
        return '';
      case 'role':
        if (value !== 'Backoffice' && value !== 'GridOperator') {
          return 'Role must be either Backoffice or GridOperator.';
        }
        return '';
      case 'password':
        if (!value) return 'Temporary password is required.';
        if (value !== value.trim()) return 'Password cannot have leading or trailing whitespace.';
        if (value.length < 8) return 'Password must be at least 8 characters long.';
        if (value.length > 72) return 'Password cannot exceed 72 characters.';
        if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter.';
        if (!/[a-z]/.test(value)) return 'Password must contain at least one lowercase letter.';
        if (!/[0-9]/.test(value)) return 'Password must contain at least one number.';
        if (!/[^A-Za-z0-9]/.test(value)) return 'Password must contain at least one special character.';
        return '';
      default:
        return '';
    }
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear field-specific error as user types
    const errorMsg = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: errorMsg }));
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);

    // Validate all fields
    const newErrors: Record<string, string> = {};
    Object.keys(formData).forEach((key) => {
      const errorMsg = validateField(key, formData[key as keyof CreateStaffUserRequestDto]);
      if (errorMsg) newErrors[key] = errorMsg;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Open confirmation dialog
    setIsConfirmOpen(true);
  }

  async function handleConfirmCreate() {
    setIsSubmitting(true);
    setServerError(null);

    try {
      const response = await userService.createStaffUser({
        fullName: formData.fullName.trim(),
        nic: formData.nic.trim().toUpperCase(),
        email: formData.email.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        role: formData.role,
        password: formData.password,
      });

      // Clear password and form immediately for security
      setFormData({
        fullName: '',
        nic: '',
        email: '',
        phoneNumber: '',
        role: 'Backoffice',
        password: '',
      });
      setErrors({});
      setIsConfirmOpen(false);

      setCreatedUserSuccess({
        fullName: response.fullName,
        nic: response.nic,
        role: formData.role === 'Backoffice' ? 'Backoffice' : 'Grid Operator',
      });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Failed to create staff account.');
      setIsConfirmOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back button & title */}
      <div>
        <Link
          to="/backoffice/users"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to User Directory</span>
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <UserPlus className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Create Staff Account
            </h1>
            <p className="text-sm text-slate-500">
              Provision internal staff accounts for Backoffice administrators or Grid Operators.
            </p>
          </div>
        </div>
      </div>

      {/* Server error alert */}
      {serverError && (
        <AlertBanner
          type="error"
          message={serverError}
          onClose={() => setServerError(null)}
        />
      )}

      {/* Success banner */}
      {createdUserSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-base font-semibold text-emerald-900">
                Staff Account Created Successfully!
              </h3>
              <p className="mt-1 text-sm text-emerald-700">
                Staff account for <strong>{createdUserSuccess.fullName}</strong> ({createdUserSuccess.nic}) has been provisioned with the <strong>{createdUserSuccess.role}</strong> role.
              </p>
              <div className="mt-4 flex gap-3">
                <Link
                  to={`/backoffice/users/${encodeURIComponent(createdUserSuccess.nic)}`}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                >
                  View User Profile
                </Link>
                <button
                  type="button"
                  onClick={() => setCreatedUserSuccess(null)}
                  className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
                >
                  Create Another Staff Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create form card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <form onSubmit={handleFormSubmit} className="space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-semibold text-slate-900">Staff Account Details</h2>
            <p className="text-xs text-slate-500">
              All fields are required. Enter the staff member's official contact information.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Full Name */}
            <div className="sm:col-span-2">
              <label htmlFor="fullName" className="block text-sm font-medium text-slate-700">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="e.g. Kasun Perera"
                disabled={isSubmitting}
                className={`mt-1.5 w-full rounded-lg border px-3.5 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 disabled:bg-slate-50 ${
                  errors.fullName
                    ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                    : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                }`}
              />
              {errors.fullName && (
                <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.fullName}
                </p>
              )}
            </div>

            {/* NIC */}
            <div>
              <label htmlFor="nic" className="block text-sm font-medium text-slate-700">
                NIC / Employee Identity <span className="text-rose-500">*</span>
              </label>
              <input
                id="nic"
                name="nic"
                type="text"
                value={formData.nic}
                onChange={handleChange}
                placeholder="e.g. 199512345678 or 951234567V"
                disabled={isSubmitting}
                className={`mt-1.5 w-full rounded-lg border px-3.5 py-2.5 text-sm font-mono uppercase transition-colors focus:outline-none focus:ring-2 disabled:bg-slate-50 ${
                  errors.nic
                    ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                    : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                }`}
              />
              {errors.nic && (
                <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.nic}
                </p>
              )}
            </div>

            {/* Role */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-slate-700">
                System Role <span className="text-rose-500">*</span>
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                disabled={isSubmitting}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
              >
                <option value="Backoffice">Backoffice (Administrative)</option>
                <option value="GridOperator">Grid Operator (Operations & Grid)</option>
              </select>
              {errors.role && (
                <p className="mt-1 text-xs text-rose-600">{errors.role}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="staff@smartsolar.lk"
                disabled={isSubmitting}
                className={`mt-1.5 w-full rounded-lg border px-3.5 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 disabled:bg-slate-50 ${
                  errors.email
                    ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                    : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                }`}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.email}
                </p>
              )}
            </div>

            {/* Phone Number */}
            <div>
              <label htmlFor="phoneNumber" className="block text-sm font-medium text-slate-700">
                Phone Number <span className="text-rose-500">*</span>
              </label>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                value={formData.phoneNumber}
                onChange={handleChange}
                placeholder="07XXXXXXXX"
                disabled={isSubmitting}
                className={`mt-1.5 w-full rounded-lg border px-3.5 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 disabled:bg-slate-50 ${
                  errors.phoneNumber
                    ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                    : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                }`}
              />
              {errors.phoneNumber && (
                <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.phoneNumber}
                </p>
              )}
            </div>

            {/* Temporary Password */}
            <div className="sm:col-span-2">
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Temporary Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Min 8 chars, uppercase, lowercase, number, special character"
                  disabled={isSubmitting}
                  className={`w-full rounded-lg border px-3.5 py-2.5 pr-10 text-sm font-mono transition-colors focus:outline-none focus:ring-2 disabled:bg-slate-50 ${
                    errors.password
                      ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200'
                      : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password ? (
                <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.password}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-slate-500">
                  Password requirements: 8-72 characters, at least 1 uppercase, 1 lowercase, 1 digit, and 1 special symbol.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
            <Link
              to="/backoffice/users"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <Shield className="h-4 w-4" />
              <span>Create Staff Account</span>
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Modal */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Confirm Staff Account Creation"
        description={`You are about to provision a new ${formData.role} account for ${formData.fullName} (NIC: ${formData.nic.toUpperCase()}) with email ${formData.email}. Please verify details before confirming.`}
        confirmText="Confirm & Create"
        variant="primary"
        isLoading={isSubmitting}
        onConfirm={handleConfirmCreate}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </div>
  );
}
