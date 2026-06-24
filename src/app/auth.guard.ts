import { CanActivateFn } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  const isValid = await authService.isTokenValid();

  if (isValid) {
    return true;
  } else {
    router.navigate(['/home'], { queryParams: { sessionExpired: true } });
    return false;
  }
};
