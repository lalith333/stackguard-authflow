import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { LogOut, Settings } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const configKeySchema = z.string()
  .min(100, 'Configuration key must be at least 100 characters')
  .max(1000, 'Configuration key must not exceed 1000 characters');

export default function Configuration() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [configKey, setConfigKey] = useState('');
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
  });

  const saveMutation = useMutation({
    mutationFn: async (key: string) => {
      if (!user) throw new Error('Not authenticated');

      if (profile?.id) {
        // Update existing profile
        const { error } = await supabase
          .from('profiles')
          .update({ configuration_key: key })
          .eq('user_id', user.id);
        
        if (error) throw error;
      } else {
        // Insert new profile
        const { error } = await supabase
          .from('profiles')
          .insert({ user_id: user.id, configuration_key: key });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
      toast.success('Configuration saved successfully');
      navigate('/dashboard');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save configuration');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      configKeySchema.parse(configKey);
      saveMutation.mutate(configKey);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent">
              <Settings className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Configuration</h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Enter Configuration Key</CardTitle>
            <CardDescription>
              Please enter your configuration key (100-1000 characters) to access the dashboard
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="config-key">Configuration Key</Label>
                <Textarea
                  id="config-key"
                  placeholder="Enter your configuration key here..."
                  className="min-h-[200px] font-mono text-sm"
                  value={configKey}
                  onChange={(e) => setConfigKey(e.target.value)}
                  disabled={saveMutation.isPending}
                />
                <p className="text-xs text-muted-foreground">
                  {configKey.length} / 1000 characters
                  {configKey.length > 0 && configKey.length < 100 && (
                    <span className="text-destructive"> (minimum 100 characters required)</span>
                  )}
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="w-full"
                disabled={saveMutation.isPending || configKey.length < 100 || configKey.length > 1000}
              >
                {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}