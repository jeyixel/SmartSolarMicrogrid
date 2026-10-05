import {
  CreateStaffUserRequestDto,
  PagedUsersResponseDto,
  UpdateUserProfileRequestDto,
  UserFilterParams,
  UserResponseDto,
} from '../types/user';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5127';

function getAuthToken(explicitToken?: string): string {
  if (explicitToken) return explicitToken;
  return sessionStorage.getItem('auth_token') || '';
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage =
        errorData?.message ||
        errorData?.title ||
        (errorData?.errors ? Object.values(errorData.errors).flat().join(', ') : null) ||
        errorMessage;
    } catch {
      if (response.statusText) {
        errorMessage = response.statusText;
      }
    }
    throw new Error(errorMessage);
  }

  // If 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const userService = {
  async getUsers(params: UserFilterParams = {}, token?: string): Promise<PagedUsersResponseDto> {
    const query = new URLSearchParams();
    if (params.search && params.search.trim()) {
      query.set('search', params.search.trim());
    }
    if (params.role !== undefined && params.role !== '') {
      query.set('role', String(params.role));
    }
    if (params.status !== undefined && params.status !== '') {
      query.set('status', String(params.status));
    }
    if (params.deactivationRequestsOnly !== undefined) {
      query.set('deactivationRequestsOnly', String(params.deactivationRequestsOnly));
    }
    if (params.page !== undefined) {
      query.set('page', String(params.page));
    }
    if (params.pageSize !== undefined) {
      query.set('pageSize', String(params.pageSize));
    }

    const authToken = getAuthToken(token);
    const url = `${API_BASE_URL}/api/users?${query.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });

    return handleResponse<PagedUsersResponseDto>(response);
  },

  async getPendingRegistrations(token?: string): Promise<UserResponseDto[]> {
    const authToken = getAuthToken(token);
    const response = await fetch(`${API_BASE_URL}/api/users/pending`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });

    return handleResponse<UserResponseDto[]>(response);
  },

  async getDeactivationRequests(token?: string): Promise<UserResponseDto[]> {
    const authToken = getAuthToken(token);
    const response = await fetch(`${API_BASE_URL}/api/users/deactivation-requests`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });

    return handleResponse<UserResponseDto[]>(response);
  },

  async getUserByNic(nic: string, token?: string): Promise<UserResponseDto> {
    const authToken = getAuthToken(token);
    const response = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(nic.trim())}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });

    return handleResponse<UserResponseDto>(response);
  },

  async createStaffUser(payload: CreateStaffUserRequestDto, token?: string): Promise<UserResponseDto> {
    const authToken = getAuthToken(token);
    const response = await fetch(`${API_BASE_URL}/api/users/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });

    return handleResponse<UserResponseDto>(response);
  },

  async activateProsumer(nic: string, token?: string): Promise<UserResponseDto> {
    const authToken = getAuthToken(token);
    const response = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(nic.trim())}/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });

    return handleResponse<UserResponseDto>(response);
  },

  async updateUser(nic: string, payload: UpdateUserProfileRequestDto, token?: string): Promise<UserResponseDto> {
    const authToken = getAuthToken(token);
    const response = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(nic.trim())}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });

    return handleResponse<UserResponseDto>(response);
  },

  async approveDeactivation(nic: string, token?: string): Promise<UserResponseDto> {
    const authToken = getAuthToken(token);
    const response = await fetch(
      `${API_BASE_URL}/api/users/${encodeURIComponent(nic.trim())}/deactivation/approve`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    return handleResponse<UserResponseDto>(response);
  },

  async rejectDeactivation(nic: string, token?: string): Promise<UserResponseDto> {
    const authToken = getAuthToken(token);
    const response = await fetch(
      `${API_BASE_URL}/api/users/${encodeURIComponent(nic.trim())}/deactivation/reject`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    return handleResponse<UserResponseDto>(response);
  },

  async reactivateProsumer(nic: string, token?: string): Promise<UserResponseDto> {
    const authToken = getAuthToken(token);
    const response = await fetch(
      `${API_BASE_URL}/api/users/${encodeURIComponent(nic.trim())}/reactivate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    return handleResponse<UserResponseDto>(response);
  },
};
