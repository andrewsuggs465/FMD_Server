import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { apiService } from '@/lib/apiService';
import { useStore, TRACKER_COLORS } from '@/lib/store';
import { toast } from 'sonner';

interface AddTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddTrackerModal = ({ isOpen, onClose }: AddTrackerModalProps) => {
  const [deviceId, setDeviceId] = useState('');
  const [label, setLabel] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmedId = deviceId.trim();
    const trimmedLabel = label.trim();
    if (!trimmedId || !password) return;

    const { trackers } = useStore.getState();
    const color = TRACKER_COLORS[trackers.length % TRACKER_COLORS.length];

    setLoading(true);
    try {
      await apiService.loginAsTracker(
        trimmedId,
        password,
        trimmedLabel || trimmedId,
        color
      );
      toast.success(`${trimmedLabel || trimmedId} added`);
      setDeviceId('');
      setLabel('');
      setPassword('');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add tracker');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && deviceId.trim() && password) void handleSubmit();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Tracked Device</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tracker-id">Device ID</Label>
            <Input
              id="tracker-id"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="securepouch-001"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tracker-label">Label (optional)</Label>
            <Input
              id="tracker-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="SecurePouch"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tracker-password">Password</Label>
            <Input
              id="tracker-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <Button
            onClick={() => void handleSubmit()}
            disabled={loading || !deviceId.trim() || !password}
            className="w-full"
          >
            {loading ? <Spinner size="sm" /> : 'Add Device'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
