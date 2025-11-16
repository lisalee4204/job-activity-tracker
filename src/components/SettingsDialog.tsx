import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SettingsDialogProps {
  weeklyGoal: number;
  onGoalChange: (goal: number) => void;
}

export const SettingsDialog = ({ weeklyGoal, onGoalChange }: SettingsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [goalValue, setGoalValue] = useState(weeklyGoal.toString());
  const { toast } = useToast();

  useEffect(() => {
    setGoalValue(weeklyGoal.toString());
  }, [weeklyGoal]);

  const handleSave = async () => {
    const goal = parseInt(goalValue);
    
    if (isNaN(goal) || goal < 1) {
      toast({
        title: "Invalid goal",
        description: "Please enter a number greater than 0",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        weekly_goal: goal,
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    onGoalChange(goal);
    toast({
      title: "Settings saved",
      description: `Weekly goal updated to ${goal} activities`,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Job Search Settings</DialogTitle>
          <DialogDescription>
            Configure your weekly activity goals and preferences
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="weeklyGoal">Weekly Activity Goal</Label>
            <Input
              id="weeklyGoal"
              type="number"
              min="1"
              value={goalValue}
              onChange={(e) => setGoalValue(e.target.value)}
              placeholder="3"
            />
            <p className="text-sm text-muted-foreground">
              Number of job search activities required per week to stay compliant
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
