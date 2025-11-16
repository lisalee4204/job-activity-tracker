import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';

export function GmailConnectButton() {
  const handleConnectGmail = () => {
    toast.info('Gmail integration coming soon! For now, use the Email Import dialog to manually paste emails.');
  };

  return (
    <Button
      onClick={handleConnectGmail}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      <Mail className="h-4 w-4" />
      Connect Gmail
    </Button>
  );
}
