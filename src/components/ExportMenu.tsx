import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { JobSearchActivity } from '@/types/jobSearch';
import { exportToCSV, exportToPDF } from '@/lib/exportUtils';
import { toast } from 'sonner';

interface ExportMenuProps {
  activities: JobSearchActivity[];
  weeklyGoal: number;
}

export const ExportMenu = ({ activities, weeklyGoal }: ExportMenuProps) => {
  const handleExportCSV = () => {
    if (activities.length === 0) {
      toast.error('No activities to export');
      return;
    }
    try {
      exportToCSV(activities);
      toast.success('Exported to CSV successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export CSV');
    }
  };

  const handleExportPDF = () => {
    if (activities.length === 0) {
      toast.error('No activities to export');
      return;
    }
    try {
      exportToPDF(activities, weeklyGoal);
      toast.success('Exported to PDF successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export PDF');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportPDF} className="gap-2">
          <FileText className="h-4 w-4" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportCSV} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
