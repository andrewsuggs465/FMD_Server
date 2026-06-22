import { useState } from 'react';
import {
  Bell,
  BellOff,
  Crosshair,
  KeyRound,
  Lock,
  MapPin,
  Radio,
  Shield,
  ShieldOff,
  Trash2,
  Unlock,
  VolumeX,
} from 'lucide-react';
import { toast } from 'sonner';
import { useStore, type TrackerDevice } from '@/lib/store';
import { BatteryIndicator } from '@/components/BatteryIndicator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiService } from '@/lib/apiService';

interface TrackerPanelProps {
  tracker: TrackerDevice;
}

export const TrackerPanel = ({ tracker }: TrackerPanelProps) => {
  const [loadingCommand, setLoadingCommand] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [refreshingSession, setRefreshingSession] = useState(false);

  const lastLocation = tracker.locations[tracker.locations.length - 1];
  const lastSeenAge = lastLocation ? Date.now() - lastLocation.date : null;
  const isRecentlySeen = lastSeenAge !== null && lastSeenAge < 5 * 60 * 1000;

  const sendPouchCommand = async (command: string) => {
    setLoadingCommand(command);
    try {
      await apiService.sendCommandForDevice(tracker.sessionToken, tracker.rsaSigKey, command);
      toast.success(`SecurePouch command queued: ${command}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Command failed';
      if (message === 'Tracker session expired') {
        useStore.getState().setTrackerSessionExpired(tracker.fmdId, true);
      }
      toast.error(message);
    } finally {
      setLoadingCommand(null);
    }
  };

  const refreshSession = async () => {
    if (!password.trim()) return;

    setRefreshingSession(true);
    try {
      await apiService.refreshTrackerSession(tracker.fmdId, password);
      setPassword('');
      toast.success('SecurePouch session refreshed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Session refresh failed');
    } finally {
      setRefreshingSession(false);
    }
  };

  const commandDisabled = tracker.sessionExpired || loadingCommand !== null;

  return (
    <div className="flex h-full flex-col gap-4">
      {tracker.sessionExpired && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-100">
            <KeyRound className="h-4 w-4" />
            Session expired
          </div>
          <div className="flex gap-2">
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void refreshSession();
              }}
              placeholder="Pouch password"
              disabled={refreshingSession}
            />
            <Button
              onClick={() => void refreshSession()}
              disabled={refreshingSession || !password.trim()}
            >
              {refreshingSession ? 'Refreshing' : 'Refresh'}
            </Button>
          </div>
        </div>
      )}

      {/* Location card */}
      <div className="dark:border-fmd-dark-border dark:bg-fmd-dark rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full p-3" style={{ backgroundColor: tracker.color + '22' }}>
            <MapPin className="h-6 w-6" style={{ color: tracker.color }} />
          </div>

          <div className="flex-1">
            {lastLocation ? (
              <>
                <BatteryIndicator percentage={lastLocation.bat} />
                <div className="text-xs text-gray-500 dark:text-gray-400">Last seen</div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {new Date(lastLocation.date).toLocaleString()}
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400">No location data yet</div>
            )}
          </div>
        </div>

        {lastLocation && (
          <div className="mt-3 font-mono text-xs text-gray-500 dark:text-gray-400">
            {lastLocation.lat.toFixed(5)}, {lastLocation.lon.toFixed(5)}
          </div>
        )}

        {lastLocation && (
          <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {tracker.locations.length} location{tracker.locations.length !== 1 ? 's' : ''} recorded
          </div>
        )}
      </div>

      <div className="dark:border-fmd-dark-border dark:bg-fmd-dark rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
          <Radio className="h-4 w-4" />
          SecurePouch Controls
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => void sendPouchCommand('lock')}
            disabled={commandDisabled}
            title="Queue lock command for the pouch"
          >
            <Lock className="h-4 w-4" />
            Lock
          </Button>
          <Button
            variant="outline"
            onClick={() => void sendPouchCommand('unlock')}
            disabled={commandDisabled}
            title="Queue unlock command for the pouch"
          >
            <Unlock className="h-4 w-4" />
            Unlock
          </Button>
          <Button
            variant="outline"
            onClick={() => void sendPouchCommand('arm')}
            disabled={commandDisabled}
            title="Enable dead-man alarm mode"
          >
            <Shield className="h-4 w-4" />
            Arm
          </Button>
          <Button
            variant="outline"
            onClick={() => void sendPouchCommand('disarm')}
            disabled={commandDisabled}
            title="Disable dead-man alarm mode"
          >
            <ShieldOff className="h-4 w-4" />
            Disarm
          </Button>
          <Button
            variant="outline"
            onClick={() => void sendPouchCommand('locate')}
            disabled={commandDisabled}
            title="Force a fresh GNSS fix and location upload"
          >
            <Crosshair className="h-4 w-4" />
            Locate
          </Button>
          <Button
            variant="outline"
            onClick={() => void sendPouchCommand('silence')}
            disabled={commandDisabled}
            title="Stop an active alarm"
          >
            <VolumeX className="h-4 w-4" />
            Silence
          </Button>
          <Button
            variant="destructive"
            className="col-span-2"
            onClick={() => void sendPouchCommand('alarm')}
            disabled={commandDisabled}
            title="Trigger pouch siren and strobe"
          >
            {loadingCommand === 'alarm' ? (
              <BellOff className="h-4 w-4" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            Alarm
          </Button>
        </div>

        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Commands are queued on the pouch account and will be picked up by the Android relay or
          nRF9151 firmware.
        </div>
      </div>

      {/* Device info */}
      <div className="dark:border-fmd-dark-border dark:bg-fmd-dark rounded-lg border border-gray-200 bg-white p-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Device ID</span>
            <span className="font-mono text-gray-900 dark:text-white">{tracker.fmdId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Label</span>
            <span className="text-gray-900 dark:text-white">{tracker.label}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Relay state</span>
            <span
              className={
                isRecentlySeen
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-gray-900 dark:text-white'
              }
            >
              {isRecentlySeen ? 'recently seen' : 'waiting'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Session</span>
            <span
              className={
                tracker.sessionExpired
                  ? 'text-amber-600 dark:text-amber-300'
                  : 'text-gray-900 dark:text-white'
              }
            >
              {tracker.sessionExpired ? 'expired' : 'active'}
            </span>
          </div>
        </div>
      </div>

      {/* Remove */}
      <div className="dark:border-fmd-dark-border dark:bg-fmd-dark rounded-lg border border-gray-200 bg-white p-4">
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => {
            void useStore.getState().removeTracker(tracker.fmdId);
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Remove Device
        </Button>
      </div>
    </div>
  );
};
