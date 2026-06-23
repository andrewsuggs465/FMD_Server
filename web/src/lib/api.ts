import { useStore } from './store';

export const HTTP = {
  POST: 'POST',
  PUT: 'PUT',
  GET: 'GET',
} as const;

export interface Location {
  lat: number;
  lon: number;
  bat: number;
  date: number;
  time: string;
  provider: string;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  bearing?: number;
}

export const JSON_HEADER = { 'Content-Type': 'application/json' } as const;

export const ONE_WEEK_SECONDS = 7 * 24 * 60 * 60;

const trimErrorBody = (text: string) => {
  const trimmed = text.trim();
  if (trimmed.length <= 400) return trimmed;
  return `${trimmed.slice(0, 400)}...`;
};

export const buildHttpErrorMessage = (
  response: Response,
  endpoint: string,
  method: string,
  bodyText: string
) => {
  const detail = trimErrorBody(bodyText);
  const status = `${response.status} ${response.statusText}`.trim();
  const likelyCause =
    response.status === 401
      ? 'session expired, wrong password, or invalid tracker token'
      : response.status === 404
        ? 'wrong server URL or API path'
        : response.status >= 500
          ? 'server-side failure; check fmd-server logs'
          : response.status >= 300 && response.status < 400
            ? 'redirect; check HTTP/HTTPS endpoint configuration'
            : 'request rejected by the server';

  return [
    `${method} ${endpoint} failed: HTTP ${status}`,
    detail && `Server response: ${detail}`,
    `Likely cause: ${likelyCause}`,
  ]
    .filter(Boolean)
    .join('\n');
};

export const buildNetworkErrorMessage = (endpoint: string, method: string, error: unknown) => {
  const detail = error instanceof Error && error.message ? ` (${error.message})` : '';
  return `${method} ${endpoint} failed before the server replied${detail}. Check network, DNS, TLS, and the server URL.`;
};

export abstract class BaseApiService {
  abstract getSalt(userName: string): Promise<string>;
  abstract login(
    userName: string,
    password: string,
    passwordAuthHash: string,
    rememberMe: boolean
  ): Promise<void>;
  abstract logout(): Promise<void>;
  abstract getPushUrl(): Promise<string>;

  abstract deleteAccount(): Promise<void>;
  abstract deleteAllLocations(): Promise<void>;
  abstract deleteAllPictures(): Promise<void>;

  abstract sendCommand(command: string): Promise<void>;

  abstract getLocations(): Promise<Location[]>;
  abstract getPictures(): Promise<string[]>;

  abstract getTileServerUrl(): Promise<string>;
}

export const requestObject = async <T>(endpoint: string, method: string, body: object) => {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method,
      headers: JSON_HEADER,
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(buildNetworkErrorMessage(endpoint, method, error));
  }

  if (!response.ok) {
    const text = await response.text();

    if (response.status === 401) {
      void useStore.getState().logout();
      throw new Error(
        `${buildHttpErrorMessage(response, endpoint, method, text)}\nAction: log in again.`
      );
    }

    throw new Error(buildHttpErrorMessage(response, endpoint, method, text));
  }

  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
};

export const getVersion = async () => {
  let response: Response;
  try {
    response = await fetch('version');
  } catch (error) {
    throw new Error(buildNetworkErrorMessage('version', HTTP.GET, error));
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(buildHttpErrorMessage(response, 'version', HTTP.GET, text));
  }

  return response.text();
};
