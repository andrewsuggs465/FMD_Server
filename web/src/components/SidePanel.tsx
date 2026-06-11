import { Plus, Smartphone } from 'lucide-react';
import { useStore } from '@/lib/store';
import { DevicePanel } from '@/components/DevicePanel';
import { TrackerPanel } from '@/components/TrackerPanel';

interface SidePanelProps {
  onViewPhotos: () => void;
  onLocateCommand: () => void;
  onAddTracker: () => void;
}

export const SidePanel = ({ onViewPhotos, onLocateCommand, onAddTracker }: SidePanelProps) => {
  const { userData, trackers, selectedDeviceId } = useStore();
  const { setSelectedDevice } = useStore.getState();

  const activeTracker = selectedDeviceId
    ? trackers.find((t) => t.fmdId === selectedDeviceId) ?? null
    : null;

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Device tab strip */}
      <div className="dark:border-fmd-dark-border dark:bg-fmd-dark flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-white p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Phone tab */}
        <button
          onClick={() => setSelectedDevice(null)}
          className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            selectedDeviceId === null
              ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          <Smartphone className="h-3.5 w-3.5" />
          {userData?.fmdId ?? 'Phone'}
        </button>

        {/* Tracker tabs */}
        {trackers.map((tracker) => (
          <button
            key={tracker.fmdId}
            onClick={() => setSelectedDevice(tracker.fmdId)}
            className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedDeviceId === tracker.fmdId
                ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: tracker.color }}
            />
            {tracker.label}
          </button>
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
