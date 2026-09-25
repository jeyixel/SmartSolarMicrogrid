export type UserRole = 0 | 1 | 2; // 0 = Backoffice, 1 = GridOperator, 2 = Prosumer
export type AccountStatus = 0 | 1 | 2; // 0 = Pending, 1 = Active, 2 = Deactivated

export interface UserResponseDto {
  id: string;
  nic: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string;
  role: UserRole | string;
  accountStatus: AccountStatus | string;
  status?: AccountStatus | string;
  createdAt: string;
  updatedAt?: string | null;
  deactivationRequestedAt?: string | null;
  deactivatedAt?: string | null;
  deactivatedBy?: string | null;
  reactivatedAt?: string | null;
  reactivatedBy?: string | null;
}

export interface PagedUsersResponseDto {
  items: UserResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateStaffUserRequestDto {
  nic: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  role: 'Backoffice' | 'GridOperator';
}

export interface UpdateUserProfileRequestDto {
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string;
}

export interface UserFilterParams {
  search?: string;
  role?: string | number;
  status?: string | number;
  deactivationRequestsOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export function parseUserRole(role: unknown): UserRole {
  if (role === 0 || role === '0' || role === 'Backoffice') return 0;
  if (role === 1 || role === '1' || role === 'GridOperator') return 1;
  if (role === 2 || role === '2' || role === 'Prosumer') return 2;
  return 2;
}

export function parseAccountStatus(status: unknown): AccountStatus {
  if (status === 0 || status === '0' || status === 'Pending') return 0;
  if (status === 1 || status === '1' || status === 'Active') return 1;
  if (status === 2 || status === '2' || status === 'Deactivated') return 2;
  return 0;
}

export function getRoleLabel(role: unknown): string {
  const parsed = parseUserRole(role);
  switch (parsed) {
    case 0:
      return 'Backoffice';
    case 1:
      return 'Grid Operator';
    case 2:
      return 'Prosumer';
    default:
      return 'Unknown';
  }
}

export function getStatusLabel(status: unknown): string {
  const parsed = parseAccountStatus(status);
  switch (parsed) {
    case 0:
      return 'Pending';
    case 1:
      return 'Active';
    case 2:
      return 'Deactivated';
    default:
      return 'Unknown';
  }
}
