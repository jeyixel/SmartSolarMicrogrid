import type {
  ApiErrorResponse,
  CreateStationRequest,
  DeactivationEligibility,
  FieldErrors,
  PagedResponse,
  Station,
  StationListQuery,
  StationSummary,
  UpdateStationRequest,
  UserRole,
} from './types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)
  ?? 'http://localhost:5127';

/**
 * A failure the API described in its error envelope. Components branch on
 * `errorCode` rather than on the message, which is free to be reworded.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly details?: unknown;
  readonly traceId?: string;

  constructor(status: number, body: ApiErrorResponse) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = body.errorCode;
    this.details = body.details;
    this.traceId = body.traceId;
  }

  /** Field-level messages, when this was a validation failure. */
  get fieldErrors(): FieldErrors | undefined {
    if (!this.details || typeof this.details !== 'object') return undefined;

    const entries = Object.entries(this.details as Record<string, unknown>);
    if (entries.length === 0) return undefined;

    // A details object is only field errors if every value is an array of
    // strings; other codes use it for structured context instead.
    const isFieldMap = entries.every(
      ([, value]) => Array.isArray(value) && value.every((v) => typeof v === 'string'),
    );

    return isFieldMap ? (this.details as FieldErrors) : undefined;
  }
}

/** The network itself failed — no response, so no envelope to read. */
export class NetworkError extends Error {
  /** The underlying fetch rejection, kept for the console. */
  readonly reason: unknown;

  constructor(reason: unknown) {
    super(
      'Could not reach the API. Check that the backend is running and that '
      + `VITE_API_BASE_URL (${API_BASE_URL}) is correct.`,
    );
    this.name = 'NetworkError';
    this.reason = reason;
  }
}

/**
 * Identity for the current session.
 *
 * Member 1 owns authentication. Until their login exists, the role is chosen in
 * the header and sent as the debug headers the backend's development handler
 * reads. When the real scheme lands, this is the one place that changes: set
 * `Authorization: Bearer <token>` instead and delete the debug headers.
 */
let currentRole: UserRole = 'Backoffice';
let currentUserId = 'web-user';

export function setIdentity(role: UserRole, userId?: string): void {
  currentRole = role;
  if (userId) currentUserId = userId;
}

export function getIdentity(): { role: UserRole; userId: string } {
  return { role: currentRole, userId: currentUserId };
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  if (init.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  // Replace this pair with the bearer token once Member 1's login exists.
  headers.set('X-Debug-Role', currentRole);
  headers.set('X-Debug-UserId', currentUserId);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch (cause) {
    throw new NetworkError(cause);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const rawBody = await response.text();

  if (!response.ok) {
    let envelope: ApiErrorResponse;
    try {
      envelope = JSON.parse(rawBody) as ApiErrorResponse;
    } catch {
      // A failure that did not come from the API's own error handling — a proxy
      // error page, say. Synthesise an envelope so callers have one shape.
      envelope = {
        success: false,
        errorCode: response.status === 401 ? 'UNAUTHENTICATED' : 'INTERNAL_ERROR',
        message: response.status === 401
          ? 'You are not signed in.'
          : `The server responded with ${response.status}.`,
      };
    }
    throw new ApiError(response.status, envelope);
  }

  return rawBody ? (JSON.parse(rawBody) as T) : (undefined as T);
}

function buildQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }

  const query = search.toString();
  return query ? `?${query}` : '';
}

export const stationsApi = {
  /** Paged management list. Backoffice and Grid Operator only. */
  list(query: StationListQuery = {}): Promise<PagedResponse<StationSummary>> {
    return request(`/api/stations${buildQuery({ ...query })}`);
  },

  /** Full document including audit fields. */
  getById(id: string): Promise<Station> {
    return request(`/api/stations/${encodeURIComponent(id)}`);
  },

  create(body: CreateStationRequest): Promise<Station> {
    return request('/api/stations', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  update(id: string, body: UpdateStationRequest): Promise<Station> {
    return request(`/api/stations/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  /**
   * Refused while the reservation module reports active reservations against
   * the station, and refused outright if that module cannot be reached.
   */
  deactivate(id: string, reason?: string): Promise<Station> {
    return request(`/api/stations/${encodeURIComponent(id)}/deactivate`, {
      method: 'PATCH',
      body: JSON.stringify({ reason: reason ?? null }),
    });
  },

  activate(id: string): Promise<Station> {
    return request(`/api/stations/${encodeURIComponent(id)}/activate`, {
      method: 'PATCH',
    });
  },

  /** Read-only pre-check, so the UI can warn before the operator clicks. */
  deactivationEligibility(id: string): Promise<DeactivationEligibility> {
    return request(`/api/stations/${encodeURIComponent(id)}/deactivation-eligibility`);
  },
};

export { API_BASE_URL };
