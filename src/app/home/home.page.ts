import { Component, QueryList, ViewChildren } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { EventosService } from '../services/eventos.service';
import { NavController } from '@ionic/angular';
import { DialogService } from '../services/dialog.service';
import { UtilsService } from '../services/utils.service';
import { AuthService } from '../services/auth.service';
import { RegistroAsistenciaService } from '../services/registro-asistencia.service';
import { IonInput } from '@ionic/angular';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone:false
})
export class HomePage {
  form!: FormGroup;
  pin: string[] = ['', '', '', '', '', ''];
  private ingresando = false;

  @ViewChildren('pinInput') pinInputs!: QueryList<IonInput>;

  constructor(
    private fb: FormBuilder,
    private eventos: EventosService,
    private nav: NavController,
    private utils: UtilsService,
    private dialog: DialogService,
    private route: ActivatedRoute,
    private auth: AuthService,
    private asistencia: RegistroAsistenciaService,
  ) {
    this.form = this.fb.group({});
    for (let i = 0; i < 6; i++) {
      this.form.addControl(`pin${i}`, new FormControl(''));
    }
  
    this.form.addControl('Pin', new FormControl('', Validators.required));
  }
  

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['logout']) {
        this.resetForm();
      }
    });
    void this.restaurarSesionSiExiste();
  }

  ngAfterViewInit() {
    this.focusInput(0);
  }

  /** Si hay token vigente + evento guardado, salta el PIN. */
  private async restaurarSesionSiExiste(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    if (params.get('logout') || params.get('sessionExpired')) {
      return;
    }

    const valida = await this.auth.isAuthenticated();
    if (!valida) {
      return;
    }

    const evento = await this.asistencia.obtenerEventoActivoAsync();
    if (!evento) {
      return;
    }

    this.asistencia.establecerEventoActivo(evento);
    await this.nav.navigateRoot(['/registrar-asistencia'], { state: evento });
  }

  onInputChange(event: any, index: number) {
    const raw = `${event.detail.value ?? ''}`;
    // Solo un dígito numérico por casilla
    const value = raw.replace(/\D/g, '').slice(-1);
    if (value !== raw) {
      this.form.get(`pin${index}`)?.setValue(value, { emitEvent: false });
    }

    if (value.length > 0 && index < this.pin.length - 1) {
      this.focusInput(index + 1);
    }

    this.updatePinControl();

    const pinCompleto = `${this.form.get('Pin')?.value || ''}`;
    if (pinCompleto.length === 6 && !this.ingresando) {
      void this.login();
    }
  }
  

  onKeyDown(event: KeyboardEvent, index: number) {
    const input = event.target as HTMLInputElement;
    if (event.key === 'Backspace' && !input.value && index > 0) {
      this.focusInput(index - 1);
    }
  }

  focusInput(index: number) {
    const inputs = this.pinInputs.toArray();
    if (inputs[index]) {
      setTimeout(() => inputs[index].setFocus(), 10);
    }
  }

  updatePinControl() {
    const pinValue = Array.from({ length: 6 }, (_, i) => this.form.get(`pin${i}`)?.value || '').join('');
    this.form.get('Pin')?.setValue(pinValue);
  }
  
  async login() {
    this.updatePinControl();
    if (!this.form.valid || this.ingresando) {
      return;
    }

    this.ingresando = true;
    const loading = await this.dialog.showLoading({ message: 'Ingresando...' });

    try {
      const response = await this.eventos.loginValidation({ Pin: this.form.get('Pin')?.value });
      const message = response.message;

      if (response.success) {
        const auth = {
          token: response.data.access_token,
          expires: response.data.expires,
        };

        await this.auth.setAuth(auth);
        this.asistencia.establecerEventoActivo(response.data.evento.records[0]);
        this.nav.navigateForward(['/registrar-asistencia'], { state: response.data.evento.records[0] });
      } else {
        this.resetForm();

        await this.dialog.showAlert({
          header: 'Error al ingresar',
          message,
          buttons: [{ text: 'Aceptar', role: 'ok' }],
        });
      }
    } catch (error) {
      this.resetForm();

      await this.dialog.showAlert({
        header: 'Error',
        message: 'Ocurrió un error inesperado. Por favor intenta nuevamente.',
        buttons: [{ text: 'Aceptar', role: 'ok' }],
      });
    } finally {
      this.ingresando = false;
      await this.dialog.dismissLoading();
    }
  }

  resetForm() {
    this.form.reset();
    this.pin = ['', '', '', '', '', ''];
    this.focusInput(0);
  }

  get Pin() {
    return this.form.get('Pin');
  }

  async politicasTap() {
    this.utils.openLink('https://portal.inacap.cl/politicas-de-privacidad');
  }
}
