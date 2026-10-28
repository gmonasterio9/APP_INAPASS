import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { RegistroAsistenciaService } from './services/registro-asistencia.service';

export const authGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const asistencia = inject(RegistroAsistenciaService);

  const isValid = await authService.isTokenValid();

  if (isValid) {
    return true;
  }

  await asistencia.limpiarEventoActivo();
  router.navigate(['/home'], { queryParams: { sessionExpired: true } });
  return false;
};
