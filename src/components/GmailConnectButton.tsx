import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export function GmailConnectButton() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    checkConnection();
    handleOAuthCallback();
  }, []);

  const checkConnection = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return;

      const { data } = await supabase
        .from('gmail_tokens')
        .select('id')
        .single();

      setIsConnected(!!data);
    } catch (error) {
      console.error('Error checking Gmail connection:', error);
    }
  };

  const handleOAuthCallback = async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      toast.error(`Gmail connection failed: ${error}`);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (code) {
      setIsConnecting(true);
      try {
        const redirectUri = `${window.location.origin}${window.location.pathname}`.replace(/\/+$/, '');

        // Exchange code for tokens
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('gmail-auth', {
          body: { code, redirectUri }
        });

        if (tokenError) throw tokenError;

        if (!tokenData.success) {
          throw new Error(tokenData.error || 'Failed to authenticate');
        }

        // Store tokens in database
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) throw new Error('Not authenticated');

        const expiresAt = new Date(Date.now() + tokenData.expiresIn * 1000).toISOString();

        const { error: storeError } = await supabase
          .from('gmail_tokens')
          .upsert({
            user_id: session.session.user.id,
            access_token: tokenData.accessToken,
            refresh_token: tokenData.refreshToken,
            expires_at: expiresAt,
          });

        if (storeError) throw storeError;

        // Fetch emails
        toast.info('Fetching emails from Gmail...');
        const { data: emailData, error: emailError } = await supabase.functions.invoke('fetch-gmail-emails', {
          body: { accessToken: tokenData.accessToken }
        });

        if (emailError) throw emailError;

        if (emailData.success) {
          toast.success(`Successfully imported ${emailData.count} job applications!`);
          setIsConnected(true);
          window.location.reload();
        }

      } catch (error) {
        console.error('OAuth callback error:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to connect Gmail');
      } finally {
        setIsConnecting(false);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  };

  const handleConnectGmail = async () => {
    setIsConnecting(true);
    try {
      // Use the client ID from the environment variable when available,
      // falling back to the backend config endpoint.
      let clientId = import.meta.env.VITE_GMAIL_CLIENT_ID as string | undefined;
      let scope = 'https://www.googleapis.com/auth/gmail.readonly';

      if (!clientId) {
        const { data, error } = await supabase.functions.invoke('gmail-oauth-config');
        if (error) throw error;
        clientId = data.clientId;
        scope = data.scope;
      }

      if (!clientId) throw new Error('Gmail client ID not configured');

      const redirectUri = `${window.location.origin}${window.location.pathname}`.replace(/\/+$/, '');

      // Build OAuth URL
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', scope);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');

      // Redirect to Google OAuth
      window.location.href = authUrl.toString();
    } catch (error) {
      console.error('Error connecting Gmail:', error);
      toast.error('Failed to connect Gmail. Please try again.');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const { error } = await supabase
        .from('gmail_tokens')
        .delete()
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (error) throw error;

      setIsConnected(false);
      toast.success('Gmail disconnected');
    } catch (error) {
      console.error('Error disconnecting Gmail:', error);
      toast.error('Failed to disconnect Gmail');
    }
  };

  if (isConnected) {
    return (
      <Button
        onClick={handleDisconnect}
        variant="outline"
        size="sm"
        className="gap-2 text-foreground"
      >
        <Mail className="h-4 w-4" />
        Disconnect Gmail
      </Button>
    );
  }

  return (
    <Button
      onClick={handleConnectGmail}
      variant="outline"
      size="sm"
      className="gap-2 text-foreground"
      disabled={isConnecting}
    >
      {isConnecting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Mail className="h-4 w-4" />
      )}
      {isConnecting ? 'Connecting...' : 'Connect Gmail'}
    </Button>
  );
}
