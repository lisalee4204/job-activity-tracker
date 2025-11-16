import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Plus } from 'lucide-react';
import { JobSearchActivity, ActivityType } from '@/types/jobSearch';
import { format } from 'date-fns';

interface ActivityDialogProps {
  onSave: (activity: Omit<JobSearchActivity, 'id' | 'createdAt'>) => void;
}

const activityTypes: { value: ActivityType; label: string }[] = [
  { value: 'application', label: 'Job Application' },
  { value: 'interview', label: 'Interview' },
  { value: 'networking', label: 'Networking Event' },
  { value: 'job_fair', label: 'Job Fair' },
  { value: 'resume_submission', label: 'Resume Submission' },
  { value: 'phone_call', label: 'Phone Call' },
  { value: 'email_inquiry', label: 'Email Inquiry' },
  { value: 'recruiter_contact', label: 'Recruiter Contact' },
  { value: 'other', label: 'Other' },
];

export const ActivityDialog = ({ onSave }: ActivityDialogProps) => {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    companyName: '',
    jobTitle: '',
    activityType: 'application' as ActivityType,
    jobDescriptionUrl: '',
    contactPerson: '',
    contactMethod: '',
    notes: '',
    status: 'application' as 'application' | 'assessment' | 'hr_screen' | 'hiring_manager' | 'final_round' | 'offer' | 'rejected' | undefined,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      companyName: '',
      jobTitle: '',
      activityType: 'application',
      jobDescriptionUrl: '',
      contactPerson: '',
      contactMethod: '',
      notes: '',
      status: 'application',
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Activity
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Job Search Activity</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activityType">Activity Type *</Label>
              <Select
                value={formData.activityType}
                onValueChange={(value: ActivityType) =>
                  setFormData({ ...formData, activityType: value })
                }
              >
                <SelectTrigger id="activityType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activityTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name *</Label>
            <Input
              id="companyName"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jobTitle">Job Title *</Label>
            <Input
              id="jobTitle"
              value={formData.jobTitle}
              onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jobDescriptionUrl">Job Description Link</Label>
            <Input
              id="jobDescriptionUrl"
              type="url"
              placeholder="https://..."
              value={formData.jobDescriptionUrl}
              onChange={(e) => setFormData({ ...formData, jobDescriptionUrl: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactPerson">Contact Person</Label>
              <Input
                id="contactPerson"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactMethod">Contact Method</Label>
              <Input
                id="contactMethod"
                placeholder="e.g., Phone, Email, In-person"
                value={formData.contactMethod}
                onChange={(e) => setFormData({ ...formData, contactMethod: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="application">Application Submitted</SelectItem>
                <SelectItem value="assessment">Code Assessment</SelectItem>
                <SelectItem value="hr_screen">HR Screen</SelectItem>
                <SelectItem value="hiring_manager">Hiring Manager Interview</SelectItem>
                <SelectItem value="final_round">Final Round</SelectItem>
                <SelectItem value="offer">Offer Received</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />
          
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Tip:</strong> Track each interaction as a separate activity. 
              Applied on Monday? Add an "Application" activity. 
              Interview on Friday? Add an "Interview" activity for the same job.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Activity</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
