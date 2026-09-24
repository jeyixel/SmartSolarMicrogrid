import { Badge } from '@/components/ui/badge';
import type { StationStatus } from '@/api/types';

const VARIANT_BY_STATUS = {
  Active: 'active',
  Inactive: 'inactive',
  Maintenance: 'maintenance',
} as const;

/** Station lifecycle state. The word is always shown, not just the colour. */
export function StationStatusBadge({ status }: { status: StationStatus }) {
  return <Badge variant={VARIANT_BY_STATUS[status]}>{status}</Badge>;
}
