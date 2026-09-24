import type { ReactNode } from 'react';
import { AlertTriangle, Ban, CalendarClock, ServerCrash, WifiOff } from 'lucide-react';

import { ApiError, NetworkError } from '@/api/client';
import { ERROR_CODES, type ActiveReservationDetails } from '@/api/types';
import { cn } from '@/lib/utils';

interface ErrorAlertProps {
  error: unknown;
  className?: string;
}

/**
 * Renders a failure from the API.
 *
 * The backend returns one error envelope for every failure, so this is the one
 * place that decides how a code is presented. The interesting case is
 * `STATION_HAS_ACTIVE_RESERVATIONS`: the count travels in `details`, which turns
 * an opaque refusal into something the operator can act on.
 */
export function ErrorAlert({ error, className }: ErrorAlertProps) {
  if (!error) return null;

  const { icon: Icon, title, body, tone } = describe(error);

  return (
    <div
      role="alert"
      className={cn(
        'flex gap-3 rounded-md border p-4 text-sm',
        tone === 'blocking'
          ? 'border-amber-300 bg-amber-50 text-amber-900'
          : 'border-destructive/40 bg-destructive/5 text-destructive',
        className,
      )}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-semibold">{title}</p>
        {body}
      </div>
    </div>
  );
}

function describe(error: unknown): {
  icon: typeof AlertTriangle;
  title: string;
  body: ReactNode;
  tone: 'blocking' | 'error';
} {
  if (error instanceof NetworkError) {
    return {
      icon: WifiOff,
      title: 'Cannot reach the API',
      body: <p>{error.message}</p>,
      tone: 'error',
    };
  }

  if (error instanceof ApiError) {
    switch (error.errorCode) {
      case ERROR_CODES.STATION_HAS_ACTIVE_RESERVATIONS: {
        const details = error.details as Partial<ActiveReservationDetails> | undefined;
        const count = details?.activeReservationCount;

        return {
          icon: CalendarClock,
          title: 'This station still has active reservations',
          body: (
            <div className="space-y-1">
              <p>
                {typeof count === 'number'
                  ? `${count} active reservation${count === 1 ? '' : 's'} are associated with this station.`
                  : error.message}
              </p>
              <p className="text-amber-800">
                A station cannot be taken out of service while prosumers are still
                booked onto it. Wait for those reservations to complete or be
                cancelled, then try again.
              </p>
            </div>
          ),
          tone: 'blocking',
        };
      }

      case ERROR_CODES.RESERVATION_SERVICE_UNAVAILABLE:
        return {
          icon: ServerCrash,
          title: 'Reservations could not be checked',
          body: (
            <div className="space-y-1">
              <p>{error.message}</p>
              <p className="text-amber-800">
                The station was left active on purpose: taking it offline without
                knowing its reservations could strand someone already on their way.
              </p>
            </div>
          ),
          tone: 'blocking',
        };

      case ERROR_CODES.FORBIDDEN_OPERATION:
        return {
          icon: Ban,
          title: 'Not permitted for your role',
          body: <p>{error.message}</p>,
          tone: 'error',
        };

      case ERROR_CODES.VALIDATION_ERROR:
      case ERROR_CODES.INVALID_COORDINATES: {
        const fields = error.fieldErrors;
        return {
          icon: AlertTriangle,
          title: 'Please correct the highlighted fields',
          body: fields ? (
            <ul className="list-inside list-disc space-y-0.5">
              {Object.entries(fields).flatMap(([field, messages]) =>
                messages.map((message) => <li key={`${field}-${message}`}>{message}</li>),
              )}
            </ul>
          ) : (
            <p>{error.message}</p>
          ),
          tone: 'error',
        };
      }

      default:
        return {
          icon: AlertTriangle,
          title: error.message,
          body: error.traceId ? (
            <p className="text-xs opacity-80">Trace id: {error.traceId}</p>
          ) : null,
          tone: 'error',
        };
    }
  }

  return {
    icon: AlertTriangle,
    title: 'Something went wrong',
    body: <p>{error instanceof Error ? error.message : String(error)}</p>,
    tone: 'error',
  };
}
