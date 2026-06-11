import { Clock, Plus, Smartphone } from 'lucide-react';
import { useStore, type TimeFilter } from '@/lib/store';

const TIME_FILTER_OPTIONS: { value: TimeFilter; label: string }[] = [
  { value: '1h', label: '1h' },
  { value: '6h', label: '6h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: 'all', label: 'All' },
];

interface MapOverlayProps {
  onAddTracker: () => void;
}

export const MapOverlay = ({ onAddTracker }: MapOverlayProps) => {
  const { trackers, timeFilter, phoneVisible, userData } = useStore();
  const { togglePhoneVisible, toggleTrackerVisible, setTimeFilter } = useStore.getState();

  return (
    <div className="pointer-events-none absolute left-2 right-2 top-2 z-[1001] flex flex-col gap-2">
      {/* Device visibility chips */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Phone chip */}
        <button
          onClick={togglePhoneVisible}
          className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/90 px-3 py-1.5 text-sm shadow backdrop-blur dark:border-gray-700 dark:bg-gray-800/90"
        >
          <Smartphone
            className="h-3.5 w-3.5"
            style={{ color: phoneVisible ? '#3b82f6' : '#9ca3af' }}
          />
          <span className={phoneVisible ? 'text-gray-900 dark:text-white' : 'text-gray-400'}>
            {userData?.fmdId ?? 'My Phone'}
          </span>
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: phoneVisible ? '#3b82f6' : '#9ca3af' }}
          />
        </button>

        {/* Tracker chips */}
        {trackers.map((tracker) => (
          <button
            key={tracker.fmdId}
            onClick={() => toggleTrackerVisible(tracker.fmdId)}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-gray-200 bg-white/90 px-3 py-1.5 text-sm shadow backdrop-blur dark:border-gray-700 dark:bg-gray-800/90"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: tracker.visible ? tracker.color : '#9ca3af' }}
            />
            <span className={tracker.visible ? 'text-gray-900 dark:text-white' : 'text-gray-400'}>
              {tracker.label}
            </span>
          </button>
        ))}

        {/* Add tracker button */}
        <button
          onClick={onAddTracker}
          className="pointer-events-auto flex items-center gap-1 rounded-full border border-gray-200 bg-white/90 px-3 py-1.5 text-sm text-gray-600 shadow backdrop-blur hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800/90 dark:text-gray-300 dark:hover:text-white"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>

      {/* Time filter */}
      <div className="pointer-events-auto flex w-fit items-center gap-1 rounded-full border border-gray-200 bg-white/90 px-2 py-1 shadow backdrop-blur dark:border-gray-700 dark:bg-gray-800/90">
        <Clock className="ml-1 h-3.5 w-3.5 text-gray-500" />
        {TIME_FILTER_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTimeFilter(value)}
            className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
              timeFilter === value
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};
