import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const GmailImportDialog = ({ onImportComplete }: { onImportComplete: () => void }) => {
  const [open, setOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [dateRange, setDateRange] = useState<'7d' | '14d' | '30d' | 'custom'>('7d');
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const { toast } = useToast();

  const handleImport = async () => {
    try {
      setIsImporting(true);

      // Get the access token from stored gmail tokens
      const { data: tokenData, error: tokenError } = await supabase
        .from('gmail_tokens')
        .select('access_token')
        .single();

      if (tokenError || !tokenData) {
        toast({
          title: 'Not connected',
          description: 'Please connect your Gmail account first.',
          variant: 'destructive',
        });
        return;
      }

      // Calculate date range
      let daysAgo = 7;
      if (dateRange === '14d') daysAgo = 14;
      if (dateRange === '30d') daysAgo = 30;
      if (dateRange === 'custom' && customStartDate) {
        const diffTime = Math.abs(new Date().getTime() - customStartDate.getTime());
        daysAgo = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      const { data, error } = await supabase.functions.invoke('fetch-gmail-emails', {
        body: { accessToken: tokenData.access_token, daysAgo },
      });

      if (error) throw error;

      toast({
        title: 'Import successful',
        description: `Imported ${data.count} job application activities`,
      });

      setOpen(false);
      onImportComplete();
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: 'Import failed',
        description: error.message || 'Failed to import emails',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-foreground">
          <Mail className="h-4 w-4 mr-2" />
          Import from Gmail
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Job Applications</DialogTitle>
          <DialogDescription>
            Import job application confirmation emails from your Gmail account
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Date Range</Label>
            <RadioGroup value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="7d" id="7d" />
                <Label htmlFor="7d" className="font-normal cursor-pointer">
                  Last 7 days
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="14d" id="14d" />
                <Label htmlFor="14d" className="font-normal cursor-pointer">
                  Last 14 days
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="30d" id="30d" />
                <Label htmlFor="30d" className="font-normal cursor-pointer">
                  Last 30 days
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="font-normal cursor-pointer">
                  Custom range
                </Label>
              </div>
            </RadioGroup>
          </div>

          {dateRange === 'custom' && (
            <div className="space-y-3 pl-6">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !customStartDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      initialFocus
                      className="pointer-events-auto"
                      disabled={(date) => date > new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>End Date (optional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !customEndDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customEndDate ? format(customEndDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      initialFocus
                      className="pointer-events-auto"
                      disabled={(date) => date > new Date() || (customStartDate && date < customStartDate)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={isImporting}>
            {isImporting ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
