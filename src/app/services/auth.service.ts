import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import * as moment from 'moment';

interface Auth {
  token: string;
  expires: number; 
  expiration_date?: moment.Moment;  
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private storageAuth: string = 'auth_token';

  constructor() { }

  async isAuthenticated(): Promise<boolean> {
    return await this.isTokenValid();
  }
  
  async isTokenValid() {
    let auth = await this.getAuth();

    if (auth) {
      let now = moment();
      let expiration_date = moment(auth.expiration_date);

      if (now.isSameOrBefore(expiration_date, 'seconds')) {
        return true;
      }
      else {
        await this.clearAuth();
      }
    }

    return false;
  }
  async getAuth() {
    return this.getStorage(this.storageAuth);
  }
  async getStorage(key: string) {
    return Preferences.get({ key: key }).then(result => {
      return result.value ? JSON.parse(result.value) : null;
    });
  }
  async clearAuth() {
    await Preferences.remove({ key: 'auth_token' });
  }

  async setAuth(auth: Auth) {
    if (auth.expires > 0) {
      auth.expiration_date = moment().add(auth.expires, 'minutes');
      auth.expires = 0;  
    }
    await Preferences.set({ key: this.storageAuth, value: JSON.stringify(auth) });
  }
 
}
