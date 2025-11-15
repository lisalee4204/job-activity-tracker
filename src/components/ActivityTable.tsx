import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { JobSearchActivity } from '@/types/jobSearch';
import { format, parseISO } from 'date-fns';
import { Trash2 } from 'lucide-react';

interface ActivityTableProps {
  activities: JobSearchActivity[];
  onDelete: (id: string) => void;
}

const activityTypeLabels: Record<string, string> = {
  application: 'Application',
  interview: 'Interview',
  networking: 'Networking',
  job_fair: 'Job Fair',
  resume_submission: 'Resume',
  phone_call: 'Phone Call',
  email_inquiry: 'Email',
  recruiter_contact: 'Recruiter',
  other: 'Other',
};

export const ActivityTable = ({ activities, onDelete }: ActivityTableProps) => {
  if (activities.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No activities recorded yet. Add your first job search activity above.
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Job Title</TableHead>
            <TableHead>Activity Type</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activities.map((activity) => (
            <TableRow key={activity.id}>
              <TableCell className="font-medium">
                {format(parseISO(activity.date), 'MMM d, yyyy')}
              </TableCell>
              <TableCell>{activity.companyName}</TableCell>
              <TableCell>{activity.jobTitle}</TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {activityTypeLabels[activity.activityType]}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {activity.contactPerson || '-'}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(activity.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
