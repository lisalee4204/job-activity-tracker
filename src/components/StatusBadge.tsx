import { Badge } from '@/components/ui/badge';

type Status = 'application' | 'assessment' | 'hr_screen' | 'hiring_manager' | 'final_round' | 'offer' | 'rejected';

const statusConfig: Record<Status, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  application: { label: 'Application', variant: 'outline' },
  assessment: { label: 'Assessment', variant: 'secondary' },
  hr_screen: { label: 'HR Screen', variant: 'secondary' },
  hiring_manager: { label: 'Hiring Manager', variant: 'secondary' },
  final_round: { label: 'Final Round', variant: 'default' },
  offer: { label: 'Offer', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
};

export const StatusBadge = ({ status }: { status?: string }) => {
  if (!status) return null;
  
  const config = statusConfig[status as Status] || { label: status, variant: 'outline' as const };
  
  return <Badge variant={config.variant}>{config.label}</Badge>;
};
