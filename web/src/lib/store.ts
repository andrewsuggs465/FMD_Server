import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storeKeys, clearKeys, getKeys, storeTrackerKeys, getTrackerKeys, clearTrackerKeys } from '@/lib/keystore';
import type { Location } from '@/lib/api';
import type { Language } from '@/lib/i18n';

export type Theme = 'light' | 'dark' | 'system';
export type UnitSystem = 'metric' | 'imperial';
export type TimeFilter = '1h' | '6h' | '24h' | '7d' | 'all';
export type { Language } from '@/lib/i18n';

export const TRACKER_COLORS = ['#f97316', '#a855f7', '#ef4444', '#14b8a6', '#eab308', '#ec4899'];

interface UserData {
  fmdId: string;
  sessionToken: string;
  rsaEncKey: CryptoKey;
  rsaSigKey: CryptoKey;
}

interface PersistedTracker {
  fmdId: string;
  label: string;
  sessionToken: string;
  color: string;
}

export interface TrackerDevice {
  fmdId: string;
  label: string;
  sessionToken: string;
  rsaEncKey: CryptoKey;
  rsaSigKey: CryptoKey;
  locations: Location[];
  visible: boolean;
  color: string;
}

const KEY_AUTH = 'fmd-auth';
const KEY_SETTINGS = 'fmd-settings';
const KEY_TRACKERS = 'fmd-trackers';

interface AppState {
  isLoggedIn: boolean;
  userData: UserData | null;
  wasAuthRestoreTried: boolean;
  theme: Theme;
  units: UnitSystem;
  language: Language;
  pushUrl: string | null;
  isPushUrlLoading: boolean;

  locations: Location[];
  currentLocationIndex: number;
  isLocationsLoading: boolean;
  phoneVisible: boolean;

  trackers: TrackerDevice[];
  timeFilter: TimeFilter;

  pictures: string[];
  isPicturesLoading: boolean;

  setUserData: (data: UserData, persistent: boolean) => Promise<void>;
  logout: () => Promise<void>;
  restoreAuth: () => Promise<void>;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;

  selectedDeviceId: string | null;
  setSelectedDevice: (id: string | null) => void;

  togglePhoneVisible: () => void;
  setTimeFilter: (filter: TimeFilter) => void;

  addTracker: (device: Omit<TrackerDevice, 'locations' | 'visible'>) => Promise<void>;
  removeTracker: (fmdId: string) => Promise<void>;
  toggleTrackerVisible: (fmdId: string) => void;
  setTrackerLocations: (fmdId: string, locations: Location[]) => void;
  restoreTrackers: () => Promise<void>;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      userData: null,
      wasAuthRestoreTried: false,
      theme: 'system',
      units: 'metric',
      language: 'en',
      pushUrl: null,
      locations: [],
      currentLocationIndex: 0,
      pictures: [],
      isPushUrlLoading: false,
      isLocationsLoading: false,
      isPicturesLoading: false,
      phoneVisible: true,
      trackers: [],
      timeFilter: 'all',
      selectedDeviceId: null,

      setUserData: async (data: UserData, persistent: boolean) => {
        if (persistent) {
          await storeKeys({
            rsaEncKey: data.rsaEncKey,
            rsaSigKey: data.rsaSigKey,
          });

          localStorage.setItem(
            KEY_AUTH,
            JSON.stringify({
              fmdId: data.fmdId,
              sessionToken: data.sessionToken,
            })
          );
        }

        set({
          userData: data,
          isLoggedIn: true,
        });
      },

      logout: async () => {
        localStorage.removeItem(KEY_AUTH);
        await clearKeys();
        set({
          userData: null,
          isLoggedIn: false,
          pushUrl: null,
          locations: [],
          pictures: [],
        });
      },

      restoreAuth: async () => {
        try {
          const authData = localStorage.getItem(KEY_AUTH);
          if (!authData) return;

          const parsed = JSON.parse(authData) as {
            fmdId: string;
            sessionToken: string;
          };
          const keys = await getKeys();

          if (keys) {
            set({
              userData: {
                fmdId: parsed.fmdId,
                sessionToken: parsed.sessionToken,
                rsaEncKey: keys.rsaEncKey,
                rsaSigKey: keys.rsaSigKey,
              },
              isLoggedIn: true,
            });
          }
        } catch {
          localStorage.removeItem(KEY_AUTH);
          await clearKeys();
        } finally {
          set({ wasAuthRestoreTried: true });
        }
      },

      setTheme: (theme: Theme) => {
        set({ theme });

        const isDark =
          theme === 'dark' ||
          (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

        document.documentElement.classList.toggle('dark', isDark);
      },

      setLanguage: (language: Language) => {
        set({ language });
      },

      setSelectedDevice: (id) => {
        set({ selectedDeviceId: id });
      },

      togglePhoneVisible: () => {
        set((state) => ({ phoneVisible: !state.phoneVisible }));
      },

      setTimeFilter: (filter: TimeFilter) => {
        set({ timeFilter: filter });
      },

      addTracker: async (device) => {
        await storeTrackerKeys(device.fmdId, {
          rsaEncKey: device.rsaEncKey,
          rsaSigKey: device.rsaSigKey,
        });

        const persisted: PersistedTracker = {
          fmdId: device.fmdId,
          label: device.label,
          sessionToken: device.sessionToken,
          color: device.color,
        };

        const existing = JSON.parse(localStorage.getItem(KEY_TRACKERS) || '[]') as PersistedTracker[];
        const updated = [...existing.filter((t) => t.fmdId !== device.fmdId), persisted];
        localStorage.setItem(KEY_TRACKERS, JSON.stringify(updated));

        set((state) => ({
          trackers: [
            ...state.trackers.filter((t) => t.fmdId !== device.fmdId),
            { ...device, locations: [], visible: true },
          ],
        }));
      },

      removeTracker: async (fmdId) => {
        await clearTrackerKeys(fmdId);
        const existing = JSON.parse(localStorage.getItem(KEY_TRACKERS) || '[]') as PersistedTracker[];
        localStorage.setItem(KEY_TRACKERS, JSON.stringify(existing.filter((t) => t.fmdId !== fmdId)));
        set((state) => ({
          trackers: state.trackers.filter((t) => t.fmdId !== fmdId),
          selectedDeviceId: state.selectedDeviceId === fmdId ? null : state.selectedDeviceId,
        }));
      },

      toggleTrackerVisible: (fmdId) => {
        set((state) => ({
          trackers: state.trackers.map((t) =>
            t.fmdId === fmdId ? { ...t, visible: !t.visible } : t
          ),
        }));
      },

      setTrackerLocations: (fmdId, locations) => {
        set((state) => ({
          trackers: state.trackers.map((t) =>
            t.fmdId === fmdId ? { ...t, locations } : t
          ),
        }));
      },

      restoreTrackers: async () => {
        const stored = localStorage.getItem(KEY_TRACKERS);
        if (!stored) return;

        let persisted: PersistedTracker[];
        try {
          persisted = JSON.parse(stored) as PersistedTracker[];
        } catch {
          return;
        }

        const restored: TrackerDevice[] = [];
        for (const p of persisted) {
          try {
            const keys = await getTrackerKeys(p.fmdId);
            if (keys) {
              restored.push({
                fmdId: p.fmdId,
                label: p.label,
                sessionToken: p.sessionToken,
                color: p.color,
                rsaEncKey: keys.rsaEncKey,
                rsaSigKey: keys.rsaSigKey,
                locations: [],
                visible: true,
              });
            }
          } catch {
            // Skip trackers whose keys failed to load
          }
        }

        if (restored.length > 0) {
          set({ trackers: restored });
        }
      },
    }),

    {
      name: KEY_SETTINGS,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        units: state.units,
        language: state.language,
      }),
    }
  )
);

export const logout = () => useStore.getState().logout();
