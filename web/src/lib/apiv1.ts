import { logout, useStore } from '@/lib/store';
import { decryptData, hashPasswordForLogin, sign, unwrapPrivateKey } from './crypto';
import {
  BaseApiService,
  HTTP,
  JSON_HEADER,
  Location,
  ONE_WEEK_SECONDS,
  buildHttpErrorMessage,
  buildNetworkErrorMessage,
  requestObject,
} from './api';

interface DataPackage {
  IDT: string;
  Data: string;
}

interface TileServerUrlResponse {
  TileServerUrl: string;
}

const API_BASE = 'api/v1';

export const ENDPOINTS = {
  SALT: `${API_BASE}/salt`,
  REQUEST_ACCESS: `${API_BASE}/requestAccess`,
  PRIVATE_KEY: `${API_BASE}/key`,
  PUBLIC_KEY: `${API_BASE}/pubKey`,
  LOCATIONS: `${API_BASE}/locations`,
  LOCATIONS_DELETE: `${API_BASE}/locations/delete`,
  COMMAND: `${API_BASE}/command`,
  DEVICE: `${API_BASE}/device`,
  PICTURES: `${API_BASE}/pictures`,
  PICTURES_DELETE: `${API_BASE}/pictures/delete`,
  PUSH: `${API_BASE}/push`,
  TILE_SERVER: `${API_BASE}/tileServerUrl`,
  VERSION: `${API_BASE}/version`,
} as const;

export class ApiV1Service extends BaseApiService {
  async getSalt(userName: string): Promise<string> {
    const response = await requestObject<DataPackage>(ENDPOINTS.SALT, HTTP.PUT, {
      IDT: userName,
      Data: 'unused',
    });
    return response.Data;
  }

  async login(
    userName: string,
    password: string,
    passwordAuthHash: string,
    rememberMe: boolean
  ): Promise<void> {
    const sessionDurationSeconds = rememberMe ? ONE_WEEK_SECONDS : 0;

    const response = await requestObject<DataPackage>(ENDPOINTS.REQUEST_ACCESS, HTTP.PUT, {
      IDT: userName,
      Data: passwordAuthHash,
      SessionDurationSeconds: sessionDurationSeconds,
    });
    const sessionToken = response.Data;

    const wrappedPrivateKey = await this.getWrappedPrivateKey(sessionToken);

    const { rsaEncKey, rsaSigKey } = await unwrapPrivateKey(password, wrappedPrivateKey);

    const { setUserData } = useStore.getState();
    await setUserData(
      {
        fmdId: userName,
        rsaEncKey,
        rsaSigKey,
        sessionToken,
      },
      rememberMe
    );
  }

  async getWrappedPrivateKey(sessionToken: string) {
    const response = await requestObject<DataPackage>(ENDPOINTS.PRIVATE_KEY, HTTP.PUT, {
      IDT: sessionToken,
      Data: 'unused',
    });
    return response.Data;
  }

  async logout(): Promise<void> {
    // not implemented in API v1
  }

  async getPushUrl(): Promise<string> {
    const { userData } = useStore.getState();

    let response: Response;
    try {
      response = await fetch(ENDPOINTS.PUSH, {
        method: HTTP.POST,
        headers: JSON_HEADER,
        body: JSON.stringify({ IDT: userData!.sessionToken, Data: '' }),
      });
    } catch (error) {
      throw new Error(buildNetworkErrorMessage(ENDPOINTS.PUSH, HTTP.POST, error));
    }

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 401) {
        void logout();
        throw new Error(
          `${buildHttpErrorMessage(response, ENDPOINTS.PUSH, HTTP.POST, text)}\nAction: log in again.`
        );
      }
      throw new Error(buildHttpErrorMessage(response, ENDPOINTS.PUSH, HTTP.POST, text));
    }

    return response.text();
  }

  async deleteAccount(): Promise<void> {
    const { userData } = useStore.getState();
    await requestObject(ENDPOINTS.DEVICE, HTTP.POST, {
      IDT: userData!.sessionToken,
      Data: '',
    });
  }

  async deleteAllLocations(): Promise<void> {
    const { userData } = useStore.getState();
    await requestObject(ENDPOINTS.LOCATIONS_DELETE, HTTP.POST, {
      IDT: userData!.sessionToken,
      Data: '',
    });
  }

  async deleteAllPictures(): Promise<void> {
    const { userData } = useStore.getState();
    await requestObject(ENDPOINTS.PICTURES_DELETE, HTTP.POST, {
      IDT: userData!.sessionToken,
      Data: '',
    });
  }

  async sendCommand(command: string): Promise<void> {
    const { userData } = useStore.getState();

    const timestamp = Date.now();
    const signature = await sign(userData!.rsaSigKey, `${timestamp}:${command}`);

    return requestObject(ENDPOINTS.COMMAND, HTTP.POST, {
      IDT: userData!.sessionToken,
      Data: command,
      UnixTime: timestamp,
      CmdSig: signature,
    });
  }

  async sendCommandForDevice(
    sessionToken: string,
    rsaSigKey: CryptoKey,
    command: string
  ): Promise<void> {
    const timestamp = Date.now();
    const signature = await sign(rsaSigKey, `${timestamp}:${command}`);

    let response: Response;
    try {
      response = await fetch(ENDPOINTS.COMMAND, {
        method: HTTP.POST,
        headers: JSON_HEADER,
        body: JSON.stringify({
          IDT: sessionToken,
          Data: command,
          UnixTime: timestamp,
          CmdSig: signature,
        }),
      });
    } catch (error) {
      throw new Error(
        `SecurePouch command '${command}' could not reach the server.\n${buildNetworkErrorMessage(
          ENDPOINTS.COMMAND,
          HTTP.POST,
          error
        )}`
      );
    }

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 401) {
        throw new Error('Tracker session expired');
      }
      throw new Error(
        `SecurePouch command '${command}' was not queued.\n${buildHttpErrorMessage(
          response,
          ENDPOINTS.COMMAND,
          HTTP.POST,
          text
        )}`
      );
    }
  }

  async getLocations(): Promise<Location[]> {
    const { userData } = useStore.getState();

    const response = await requestObject<string[]>(ENDPOINTS.LOCATIONS, HTTP.POST, {
      IDT: userData!.sessionToken,
      Data: '',
    });

    const encryptedLocations = response.map((jsonStr) => {
      const parsed = JSON.parse(jsonStr) as DataPackage;
      return parsed.Data;
    });

    const decryptedLocations = await Promise.all(
      encryptedLocations.map(async (encryptedLoc) => {
        const decrypted = await decryptData(userData!.rsaEncKey, encryptedLoc);
        return JSON.parse(decrypted) as Location;
      })
    );

    return decryptedLocations;
  }

  async getPictures(): Promise<string[]> {
    const { userData } = useStore.getState();

    const encryptedPictures = await requestObject<string[]>(ENDPOINTS.PICTURES, HTTP.POST, {
      IDT: userData!.sessionToken,
    });

    const decryptedPictures = await Promise.all(
      encryptedPictures.map((encryptedPic) => decryptData(userData!.rsaEncKey, encryptedPic))
    );

    return decryptedPictures;
  }

  async getTileServerUrl(): Promise<string> {
    let response: Response;
    try {
      response = await fetch(ENDPOINTS.TILE_SERVER);
    } catch (error) {
      throw new Error(buildNetworkErrorMessage(ENDPOINTS.TILE_SERVER, HTTP.GET, error));
    }

    const text = await response.text();
    if (!response.ok) {
      throw new Error(buildHttpErrorMessage(response, ENDPOINTS.TILE_SERVER, HTTP.GET, text));
    }

    const json = JSON.parse(text) as TileServerUrlResponse;
    return json.TileServerUrl;
  }

  async loginAsTracker(
    fmdId: string,
    password: string,
    label: string,
    color: string
  ): Promise<void> {
    const salt = await this.getSalt(fmdId);
    const passwordAuthHash = await hashPasswordForLogin(password, salt);

    // Use fetch directly so a 401 doesn't auto-logout the main account
    let accessResponse: Response;
    try {
      accessResponse = await fetch(ENDPOINTS.REQUEST_ACCESS, {
        method: HTTP.PUT,
        headers: JSON_HEADER,
        body: JSON.stringify({
          IDT: fmdId,
          Data: passwordAuthHash,
          SessionDurationSeconds: ONE_WEEK_SECONDS,
        }),
      });
    } catch (error) {
      throw new Error(buildNetworkErrorMessage(ENDPOINTS.REQUEST_ACCESS, HTTP.PUT, error));
    }

    if (!accessResponse.ok) {
      const text = await accessResponse.text();
      throw new Error(
        buildHttpErrorMessage(accessResponse, ENDPOINTS.REQUEST_ACCESS, HTTP.PUT, text)
      );
    }

    const accessJson = (await accessResponse.json()) as DataPackage;
    const sessionToken = accessJson.Data;

    const wrappedPrivateKey = await this.getWrappedPrivateKey(sessionToken);
    const { rsaEncKey, rsaSigKey } = await unwrapPrivateKey(password, wrappedPrivateKey);

    const { addTracker } = useStore.getState();
    await addTracker({ fmdId, label, sessionToken, rsaEncKey, rsaSigKey, color });
  }

  async refreshTrackerSession(fmdId: string, password: string): Promise<void> {
    const salt = await this.getSalt(fmdId);
    const passwordAuthHash = await hashPasswordForLogin(password, salt);

    let response: Response;
    try {
      response = await fetch(ENDPOINTS.REQUEST_ACCESS, {
        method: HTTP.PUT,
        headers: JSON_HEADER,
        body: JSON.stringify({
          IDT: fmdId,
          Data: passwordAuthHash,
          SessionDurationSeconds: ONE_WEEK_SECONDS,
        }),
      });
    } catch (error) {
      throw new Error(buildNetworkErrorMessage(ENDPOINTS.REQUEST_ACCESS, HTTP.PUT, error));
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(buildHttpErrorMessage(response, ENDPOINTS.REQUEST_ACCESS, HTTP.PUT, text));
    }

    const json = (await response.json()) as DataPackage;
    await useStore.getState().updateTrackerSessionToken(fmdId, json.Data);
  }
}

// Standalone — does not touch main account auth so a 401 throws rather than logging out
export async function getLocationsForDevice(
  sessionToken: string,
  rsaEncKey: CryptoKey
): Promise<Location[]> {
  let response: Response;
  try {
    response = await fetch(ENDPOINTS.LOCATIONS, {
      method: HTTP.POST,
      headers: JSON_HEADER,
      body: JSON.stringify({ IDT: sessionToken, Data: '' }),
    });
  } catch (error) {
    throw new Error(buildNetworkErrorMessage(ENDPOINTS.LOCATIONS, HTTP.POST, error));
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      response.status === 401
        ? 'Tracker session expired'
        : buildHttpErrorMessage(response, ENDPOINTS.LOCATIONS, HTTP.POST, text)
    );
  }

  const data = (await response.json()) as string[];

  const decryptedLocations = await Promise.all(
    data.map(async (jsonStr) => {
      const pkg = JSON.parse(jsonStr) as DataPackage;
      const decrypted = await decryptData(rsaEncKey, pkg.Data);
      return JSON.parse(decrypted) as Location;
    })
  );

  return decryptedLocations;
}
