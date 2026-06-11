import { MapPin, Trash2 } from 'lucide-react';
import { useStore, type TrackerDevice } from '@/lib/store';
import { BatteryIndicator } from '@/components/BatteryIndicator';
import { Button } from '@/components/ui/button';

interface TrackerPanelProps {
  tracker: TrackerDevice;
}

export const TrackerPanel = ({ tracker }: TrackerPanelProps) => {
  const lastLocation = tracker.locations[tracker.locations.length - 1];

  return (
    <div className="flex h-full flex-col gap-4">
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
              <div className="text-sm text-gray-500 dark:text-gray-400">
                No location data yet
              </div>
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
