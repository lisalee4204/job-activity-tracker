import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mail, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { JobSearchActivity, ActivityType } from '@/types/jobSearch';

interface EmailImportDialogProps {
  onImport: (activity: Omit<JobSearchActivity, 'id' | 'createdAt'>) => void;
}

export const EmailImportDialog = ({ onImport }: EmailImportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [emailContent, setEmailContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleParse = async () => {
    if (!emailContent.trim()) {
      toast({
        title: "Error",
        description: "Please paste an email to parse",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-email', {
        body: { emailContent }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to parse email');
      }

      const { companyName, jobTitle, date, jobDescriptionUrl } = data.data;

      // Create activity from parsed data
      const activity = {
        date,
        companyName,
        jobTitle,
        activityType: 'application' as ActivityType,
        jobDescriptionUrl: jobDescriptionUrl || '',
        contactPerson: '',
        contactMethod: 'Email',
        notes: 'Imported from email confirmation',
      };

      onImport(activity);
      
      toast({
        title: "Success",
        description: `Imported application to ${companyName}`,
      });

      setEmailContent('');
      setOpen(false);
    } catch (error: any) {
      console.error('Error parsing email:', error);
      toast({
        title: "Parse Error",
        description: error.message || "Could not extract job details from email. Please check the format.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 text-foreground">
          <Mail className="h-4 w-4" />
          Import from Email
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Job Application from Email</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="emailContent">Email Content</Label>
            <Textarea
              id="emailContent"
              placeholder="Paste your 'Thanks for applying' or job application confirmation email here..."
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              rows={12}
              className="font-mono text-sm"
            />
            <p className="text-sm text-muted-foreground">
              Our AI will automatically extract the company name, job title, date, and job posting URL from your email.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleParse} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Parse & Import
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
