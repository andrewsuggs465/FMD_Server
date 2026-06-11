import { useState, useEffect } from 'react';
import { LoginForm } from '@/components/LoginForm';
import { SidePanel } from '@/components/SidePanel';
import { LocationMap } from '@/components/LocationMap';
import { PhotosModal } from '@/components/modals/PhotosModal';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { AddTrackerModal } from '@/components/modals/AddTrackerModal';
import { Header } from '@/components/Header';
import { Spinner } from '@/components/ui/spinner';
import { apiService } from '@/lib/apiService';
import { useStore } from '@/lib/store';
import { getLocationsForDevice } from '@/lib/apiv1';
import { toast } from 'sonner';

const minute = 60 * 1000;

const Home = () => {
  const { isLoggedIn, userData, wasAuthRestoreTried, locations, trackers } = useStore();

  const [photosOpen, setPhotosOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addTrackerOpen, setAddTrackerOpen] = useState(false);
  const [lastLocateTime, setLastLocateTime] = useState<number | null>(null);
  const [lastLocationsFetchedTime, setLastLocationsFetchedTime] = useState<number | null>(null);

  const fetchLocations = async (showLoading = true) => {
    if (!userData) return;

    if (showLoading) useStore.setState({ isLocationsLoading: true });
    try {
      const decryptedLocations = await apiService.getLocations();

      const isFirstLoad = locations.length === 0;
      const hasNewLocations = decryptedLocations.length > locations.length;

      if (isFirstLoad || hasNewLocations) {
        useStore.setState({ currentLocationIndex: decryptedLocations.length - 1 });
      }

      setLastLocationsFetchedTime(Date.now());
      useStore.setState({ locations: decryptedLocations });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch locations';
      toast.error(message || 'An unknown error occurred');
    } finally {
      if (showLoading) useStore.setState({ isLocationsLoading: false });
    }
  };

  const fetchTrackerLocations = async () => {
    const { trackers: current, setTrackerLocations } = useStore.getState();
    await Promise.all(
      current.map(async (tracker) => {
        try {
          const locs = await getLocationsForDevice(tracker.sessionToken, tracker.rsaEncKey);
          setTrackerLocations(tracker.fmdId, locs);
        } catch (error) {
          const msg = error instanceof Error ? error.message : '';
          if (msg !== 'Tracker session expired') console.warn(`Tracker ${tracker.fmdId}: ${msg}`);
        }
      })
    );
  };

  useEffect(() => {
    if (isLoggedIn) void useStore.getState().restoreTrackers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn && userData) {
      void fetchLocations();
      void fetchTrackerLocations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn && trackers.length > 0) void fetchTrackerLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackers.length]);

  useEffect(() => {
    if (!isLoggedIn || !userData) return;

    const getPollingInterval = () => {
      if (!lastLocateTime) return 15 * minute;
      const timeSinceLocate = Date.now() - lastLocateTime;
      if (timeSinceLocate < 1 * minute) return 15 * 1000;
      if (timeSinceLocate < 2 * minute) return 20 * 1000;
      return 15 * minute;
    };

    const poll = () => {
      if (document.hidden) return;
      void fetchLocations(false);
      void fetchTrackerLocations();
    };

    const interval = setInterval(poll, getPollingInterval());
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, userData, lastLocateTime]);

  useEffect(() => {
    if (!isLoggedIn || !userData) return;

    const poll = () => {
      if (document.hidden || !lastLocationsFetchedTime) return;
      if (Date.now() - lastLocationsFetchedTime < 5 * minute) return;
      void fetchLocations(false);
      void fetchTrackerLocations();
    };

    window.addEventListener('visibilitychange', poll);
    return () => window.removeEventListener('visibilitychange', poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, userData, lastLocationsFetchedTime]);

  if (!wasAuthRestoreTried) {
    return (
      <div className="dark:bg-fmd-dark-lighter flex min-h-screen items-center justify-center bg-gray-50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="dark:bg-fmd-dark-lighter flex min-h-screen items-center justify-center bg-gray-50">
        <LoginForm />
      </div>
    );
  }

  return (
    <>
      <Header onSettingsClick={() => setSettingsOpen(true)} />

      <div className="dark:bg-fmd-dark-lighter flex h-[calc(100vh-3.1rem)] flex-col bg-gray-50 text-gray-900 dark:text-white">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row lg:overflow-hidden">
          {userData && (
            <div className="order-2 w-full lg:order-1 lg:w-100 lg:shrink-0">
              <SidePanel
                onViewPhotos={() => setPhotosOpen(true)}
                onLocateCommand={() => setLastLocateTime(Date.now())}
                onAddTracker={() => setAddTrackerOpen(true)}
              />
            </div>
          )}

          <div className="order-1 min-h-96 flex-1 rounded-lg lg:order-2 lg:min-h-0">
            <LocationMap />
          </div>
        </div>
      </div>

      <PhotosModal isOpen={photosOpen} onClose={() => setPhotosOpen(false)} />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AddTrackerModal isOpen={addTrackerOpen} onClose={() => setAddTrackerOpen(false)} />
    </>
  );
};

export default Home;
