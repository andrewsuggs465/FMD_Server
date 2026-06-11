import { Eye, EyeOff, Plus, Smartphone } from 'lucide-react';
import { useStore } from '@/lib/store';
import { DevicePanel } from '@/components/DevicePanel';
import { TrackerPanel } from '@/components/TrackerPanel';

interface SidePanelProps {
  onViewPhotos: () => void;
  onLocateCommand: () => void;
  onAddTracker: () => void;
}

export const SidePanel = ({ onViewPhotos, onLocateCommand, onAddTracker }: SidePanelProps) => {
  const { userData, trackers, selectedDeviceId, phoneVisible } = useStore();
  const { setSelectedDevice, togglePhoneVisible, toggleTrackerVisible } = useStore.getState();

  const activeTracker = selectedDeviceId
    ? trackers.find((t) => t.fmdId === selectedDeviceId) ?? null
    : null;

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Device tab strip */}
      <div className="dark:border-fmd-dark-border dark:bg-fmd-dark flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-white p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Phone tab */}
        <div
          className={`flex shrink-0 items-center gap-1.5 rounded-md transition-colors ${
            selectedDeviceId === null
              ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          <button
            onClick={() => setSelectedDevice(null)}
            className={`flex items-center gap-1.5 py-1.5 pl-3 text-sm font-medium ${
              phoneVisible ? '' : 'opacity-50'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            {userData?.fmdId ?? 'Phone'}
          </button>
          <button
            onClick={togglePhoneVisible}
            title={phoneVisible ? 'Hide on map' : 'Show on map'}
            className="py-1.5 pr-2 pl-0.5 opacity-60 transition-opacity hover:opacity-100"
          >
            {phoneVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </button>
        </div>

        {/* Tracker tabs */}
        {trackers.map((tracker) => (
          <div
            key={tracker.fmdId}
            className={`flex shrink-0 items-center gap-1.5 rounded-md transition-colors ${
              selectedDeviceId === tracker.fmdId
                ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            <button
              onClick={() => setSelectedDevice(tracker.fmdId)}
              className={`flex items-center gap-1.5 py-1.5 pl-3 text-sm font-medium ${
                tracker.visible ? '' : 'opacity-50'
              }`}
            >
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: tracker.color }}
              />
              {tracker.label}
            </button>
            <button
              onClick={() => toggleTrackerVisible(tracker.fmdId)}
              title={tracker.visible ? 'Hide on map' : 'Show on map'}
              className="py-1.5 pr-2 pl-0.5 opacity-60 transition-opacity hover:opacity-100"
            >
              {tracker.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            </button>
          </div>
        ))}

        {/* Add tracker */}
        <button
          onClick={onAddTracker}
          title="Add tracked device"
          className="ml-auto shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Panel content */}
      <div className="min-h-0 flex-1">
        {activeTracker ? (
          <TrackerPanel tracker={activeTracker} />
        ) : (
          <DevicePanel onViewPhotos={onViewPhotos} onLocateCommand={onLocateCommand} />
        )}
      </div>
    </div>
  );
};
