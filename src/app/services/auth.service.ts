import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import * as moment from 'moment';

interface Auth {
  token: string;
  expires: number;
  expiration_date?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private storageAuth = 'auth_token';

  constructor() { }

  async isAuthenticated(): Promise<boolean> {
    return this.isTokenValid();
  }

  async isTokenValid(): Promise<boolean> {
    const auth = await this.getAuth();
    if (!auth?.token || !auth.expiration_date) {
      return false;
    }

    const expiration = moment(auth.expiration_date);
    if (!expiration.isValid()) {
      await this.clearAuth();
      return false;
    }

    if (moment().isSameOrBefore(expiration, 'seconds')) {
      return true;
    }

    await this.clearAuth();
    return false;
  }

  async getAuth(): Promise<Auth | null> {
    return this.getStorage(this.storageAuth);
  }

  async getStorage(key: string): Promise<any> {
    const result = await Preferences.get({ key });
    if (!result.value) {
      return null;
    }
    try {
      return JSON.parse(result.value);
    } catch {
      return null;
    }
  }

  async clearAuth(): Promise<void> {
    await Preferences.remove({ key: this.storageAuth });
  }

  async setAuth(auth: Auth): Promise<void> {
    const minutos = Number(auth.expires) > 0 ? Number(auth.expires) : 1440;
    const payload: Auth = {
      token: auth.token,
      expires: 0,
      // ISO string: sobrevive bien a JSON + reinicio de app
      expiration_date: moment().add(minutos, 'minutes').toISOString(),
    };
    await Preferences.set({ key: this.storageAuth, value: JSON.stringify(payload) });
  }
}
