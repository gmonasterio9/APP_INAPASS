import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { EventosService } from '../services/eventos.service';
import { DialogService } from '../services/dialog.service';
import { Camera } from '@capacitor/camera';
import { NavController, Platform, ViewWillLeave } from '@ionic/angular';
import { UtilsService } from '../services/utils.service';
import { RegistroAsistenciaService, RegistroResultado } from '../services/registro-asistencia.service';

@Component({
  selector: 'app-registro-manual',
  templateUrl: './registro-manual.page.html',
  styleUrls: ['./registro-manual.page.scss'],
  standalone: false,
})

export class RegistroManualPage implements OnInit, ViewWillLeave {

  readonly nombreMaxLength: number;
  subiendoFoto = false;
  submitted = false;
  form!: FormGroup;
  state: any;
  registro: any[] = [];
  currentStep: number = 1;
  isLoading = false;
  private procesoCarnetId = 0;
  constructor(private router: Router,
              private pt: Platform,
              private fb: FormBuilder,
              private eventos: EventosService,
              private dialog: DialogService,
              private nav: NavController,
              private utils: UtilsService,
            private asistencia: RegistroAsistenciaService) 
  { 
    this.nombreMaxLength = this.utils.nombreMaxLength;
    this.state  = this.router.getCurrentNavigation()?.extras.state;
    this.form =this.fb.group({
      rut: ['', [Validators.required, this.rutValidator]],
      nombre: ['', [Validators.required, Validators.maxLength(this.nombreMaxLength), this.nombreCompletoValidator, this.nombreSoloLetrasValidator]],
      correo: ['', Validators.compose([Validators.required, Validators.email])],
    });
    this.configurarSanitizadoNombre();
  }

  private rutValidator = (control: AbstractControl): ValidationErrors | null => {
    const value = `${control.value ?? ''}`.trim();
    if (!value) {
      return null;
    }
    return this.utils.validarRut(value) ? null : { rutInvalido: true };
  };

  private nombreCompletoValidator = (control: AbstractControl): ValidationErrors | null => {
    const partes = `${control.value ?? ''}`.trim().split(/\s+/).filter(Boolean);
    if (!partes.length) {
      return null;
    }
    return partes.length >= 2 ? null : { nombreIncompleto: true };
  };

  private nombreSoloLetrasValidator = (control: AbstractControl): ValidationErrors | null => {
    const value = `${control.value ?? ''}`.trim();
    if (!value) {
      return null;
    }
    return this.utils.validarNombreSoloLetras(value) ? null : { nombreSoloLetras: true };
  };

  private configurarSanitizadoNombre(): void {
    this.nombre?.valueChanges.subscribe((value) => {
      const current = `${value ?? ''}`;
      const sanitized = this.utils.sanitizarNombre(current, this.nombreMaxLength);
      if (sanitized !== current) {
        this.nombre?.setValue(sanitized, { emitEvent: false });
        this.nombre?.updateValueAndValidity({ emitEvent: false });
      }
    });
  }

  get procesandoCarnet(): boolean {
    return this.isLoading || this.subiendoFoto;
  }

  get nombreLongitud(): number {
    return `${this.nombre?.value ?? ''}`.length;
  }

 async ngOnInit() {
    const participantes = await this.eventos.getParticipante(this.state?.eventId)
    if (participantes.success){
      this.registro = participantes.data.participantes;
    }
    if(this.state?.rut){
      this.rut?.setValue(this.utils.formatearRut(this.state.rut));
    }
  }

  onRutInput(event: Event): void {
    const raw = this.obtenerValorInput(event);
    const formatted = this.utils.formatearRut(raw);
    this.rut?.setValue(formatted, { emitEvent: false });
    this.rut?.updateValueAndValidity({ emitEvent: false });
  }

  private obtenerValorInput(event: Event): string {
    const customEvent = event as CustomEvent<{ value?: string | null }>;
    if (customEvent.detail?.value != null) {
      return `${customEvent.detail.value}`;
    }
    const ionInput = event.target as HTMLIonInputElement | null;
    if (ionInput?.value != null) {
      return `${ionInput.value}`;
    }
    const nativeInput = event.target as HTMLInputElement | null;
    if (nativeInput?.value != null) {
      return nativeInput.value;
    }
    return '';
  }

  private truncarNombre(value: string): string {
    return this.utils.sanitizarNombre(value.trim(), this.nombreMaxLength);
  }

  private validarPaso1(): boolean {
    this.submitted = true;
    this.rut?.markAsTouched();
    this.nombre?.markAsTouched();
    return !!(this.rut?.valid && this.nombre?.valid);
  }

  nextStep() {
    if (this.procesandoCarnet) {
      return;
    }
    if (this.validarPaso1()) {
      this.currentStep = 2;
    }
  }
  handleBack() {
    if (this.procesandoCarnet) {
      return;
    }
    void this.cancelarFormulario();
  }

  private abortarProcesoCarnet(): void {
    this.procesoCarnetId++;
    this.isLoading = false;
    this.subiendoFoto = false;
  }

  private reiniciarFormulario(): void {
    this.abortarProcesoCarnet();
    this.currentStep = 1;
    this.submitted = false;
    this.form.reset();
  }

  async cancelarFormulario(): Promise<void> {
    this.reiniciarFormulario();
    await this.volverAtras();
  }

  ionViewWillLeave(): void {
    this.reiniciarFormulario();
  }
  
  
  async registrar(){
    this.submitted = true;
    this.form.markAllAsTouched();

    if (!this.validarPaso1() || !this.form.valid) {
      await this.mostrarErrorFormulario();
      return;
    }

    const rutConsulta = this.obtenerRutConsulta();
    if (!this.utils.validarRut(rutConsulta)) {
      await this.mostrarErrorRegistro('Debe ingresar un RUT válido');
      return;
    }

    const loading = await this.dialog.showLoading({ message: 'Registrando' });
    let resultado: RegistroResultado = { success: false };

    try {
      const bodyContacto = this.crearBodyContactoDesdeForm(rutConsulta);
      resultado = this.state?.rut
        ? await this.asistencia.registrarContactoYparticipante(bodyContacto, this.state.eventId)
        : await this.validarYregistrar(rutConsulta, bodyContacto);
    } catch (error) {
      console.error('Error al registrar:', error);
      resultado = {
        success: false,
        message: 'Ocurrió un error al registrar. Intente nuevamente.',
      };
    } finally {
      await this.dialog.dismissLoading();
    }

    await this.procesarResultadoRegistro(resultado);
  }

  private obtenerRutConsulta(): string {
    let rutConsulta = `${this.rut?.value ?? ''}`.replace(/\./g, '');
    if (!rutConsulta.includes('-')) {
      rutConsulta = rutConsulta.slice(0, -1) + '-' + rutConsulta.slice(-1);
    }
    return rutConsulta;
  }

  private crearBodyContactoDesdeForm(rutConsulta: string) {
    const [name, lastname] = this.utils.separarNombre(this.nombre?.value);
    return this.asistencia.crearBodyContacto(
      name,
      lastname,
      rutConsulta,
      this.correo?.value,
      this.state?.eventArea,
      this.state?.capturingBranch__c,
    );
  }

  private async procesarResultadoRegistro(resultado: RegistroResultado): Promise<void> {
    if (resultado.success) {
      return;
    }

    await this.mostrarErrorRegistro(
      resultado.message || 'No se pudo registrar el asistente.',
      resultado.header || 'Error en formulario',
    );

    if (resultado.esDuplicado) {
      this.limpiarFormulario();
    }
  }

  private limpiarFormulario(): void {
    this.form.reset();
    this.submitted = false;
    this.currentStep = 1;
  }

  private async mostrarErrorFormulario(): Promise<void> {
    if (this.correo?.hasError('email') || this.correo?.hasError('required')) {
      await this.mostrarErrorRegistro('Debe ingresar un correo válido');
      return;
    }
    await this.mostrarErrorRegistro('Complete correctamente todos los campos del formulario.');
  }

  private async mostrarErrorRegistro(message: string, header = 'Error en formulario'): Promise<void> {
    await this.dialog.showAlert({
      header,
      message,
      buttons: [{ text: 'Aceptar', role: 'ok' }],
    });
  }

  private async mostrarErrorCarnet(message: string): Promise<void> {
    await this.dialog.showAlert({
      header: 'Error al escanear carnet',
      message,
      buttons: [{ text: 'Aceptar', role: 'ok' }],
    });
  }

  private esCancelacionCamara(error: unknown): boolean {
    const mensaje = `${(error as { message?: string })?.message ?? error ?? ''}`.toLowerCase();
    return mensaje.includes('cancel') || mensaje.includes('cancelled') || mensaje.includes('canceled');
  }

  async validarYregistrar(rutValue: string, bodyContacto: any): Promise<RegistroResultado> {
    const [invitado, registroId, attendee] = this.utils.buscarEnArray(rutValue, "identificationNumber", this.registro);
    if(invitado){
      if(attendee){
        return {
          success: false,
          esDuplicado: true,
          header: 'Registro Duplicado',
          message: 'El asistente ya ha realizado su registro para este evento.',
        };
      }

      await this.asistencia.marcarAsistencia(registroId, this.state?.eventId);
      return { success: true };
    }

    const eslead = await this.eventos.getEsLead(rutValue);
    let participanteBody: any = null;
    if(eslead.success){
      if (eslead.data.lead.totalSize !== 0) {
        participanteBody = this.asistencia.crearParticipanteBody(eslead.data.lead.records[0].Id,true,this.state?.eventId)
      }
      const escontacto = await this.eventos.getEsContacto(rutValue);
      if (escontacto.success){
        if (escontacto.data.contacto.totalSize !== 0) {
          participanteBody = this.asistencia.crearParticipanteBody(escontacto.data.contacto.records[0].Id,false,this.state?.eventId)
        }
      }
    }

    if (participanteBody) {
      const idContacto = participanteBody.IdRegistro;
      const lead = participanteBody.EsLead;
      
      if(lead){
        const datosLead = await this.eventos.datosLead(idContacto);
        if (datosLead.success){
          const correo = datosLead.data.contacto.Email.trim().toLowerCase();
          const correoIngresado = this.correo?.value.trim().toLowerCase();
  
          if (correoIngresado === correo) {
            return this.asistencia.registrarParticipante(participanteBody, this.state.eventId);
          }

          const bodyContactoCorreo = this.asistencia.crearBodyCorreoLead(this.correo?.value);
          return this.asistencia.actualizarYregistrar(bodyContactoCorreo, participanteBody.IdRegistro, this.state.eventId, lead);
        }

        return { success: false, message: 'No se pudieron validar los datos del asistente.' };
      }

      const datosContactos = await this.eventos.datosContacto(idContacto);
      if (datosContactos.success){
        const correo = datosContactos.data.contacto.hed__AlternateEmail__c.trim().toLowerCase();
        const correoIngresado = this.correo?.value.trim().toLowerCase();
        
        if (correoIngresado === correo) {
          return this.asistencia.registrarParticipante(participanteBody, this.state.eventId);
        }

        const bodyContactoCorreo = this.asistencia.crearBodyCorreoContacto(this.correo?.value);
        return this.asistencia.actualizarYregistrar(bodyContactoCorreo, participanteBody.IdRegistro, this.state.eventId, lead);
      }

      return { success: false, message: 'No se pudieron validar los datos del asistente.' };
    }

    return this.asistencia.registrarContactoYparticipante(bodyContacto, this.state.eventId);
  }

  async fotoCarnet() {
    if (this.procesandoCarnet) {
      return;
    }

    try {
      const tienePermiso = await this.utils.tienePermisoCamara();
      if (!tienePermiso) {
        await this.utils.showAlertCamera('Escanear carnet');
        return;
      }

      const image = await Camera.getPhoto(this.utils.obtenerOpcionesFotoCarnet());
      if (!image?.base64String) {
        await this.mostrarErrorCarnet('No se pudo capturar la imagen. Intente nuevamente.');
        return;
      }

      const procesoId = ++this.procesoCarnetId;
      this.currentStep = 2;
      this.isLoading = true;
      const fileName = `foto_${Date.now()}.jpg`;
      const response = await this.uploadBase64Fragmented(image.base64String, fileName);

      if (procesoId !== this.procesoCarnetId) {
        return;
      }

      if (!response.success) {
        this.currentStep = 1;
        await this.mostrarErrorCarnet(
          response.message || 'No se pudo validar el carnet. Verifique la iluminación y que el documento esté completo en la foto.',
        );
        return;
      }

      if (!response.rut) {
        this.currentStep = 1;
        await this.mostrarErrorCarnet(
          'No se pudieron leer los datos del carnet. Asegúrese de que la imagen sea nítida y el RUT sea visible.',
        );
        return;
      }

      this.nombre?.setValue(this.truncarNombre(`${response.nombre} ${response.apellido1} ${response.apellido2}`));
      this.rut?.setValue(this.utils.formatearRut(`${response.rut}`));

      if (procesoId !== this.procesoCarnetId) {
        return;
      }
    } catch (error) {
      if (this.esCancelacionCamara(error)) {
        return;
      }
      console.error('Error al escanear carnet', error);
      this.currentStep = 1;
      await this.mostrarErrorCarnet('Ocurrió un error al procesar el carnet. Intente nuevamente.');
    } finally {
      this.isLoading = false;
      this.subiendoFoto = false;
    }
  }

  async uploadBase64Fragmented(
    base64String: string,
    fileName: string,
  ): Promise<{ success: boolean; nombre?: string; apellido1?: string; apellido2?: string; rut?: string; message?: string }> {
    const fragments = this.utils.divideBase64(base64String);
    const totalParts = fragments.length;

    try {
      for (let i = 0; i < fragments.length; i++) {
        const base64Fragment = fragments[i];
        const partNumber = i + 1;
        const params = {
          file: base64Fragment,
          fileName: encodeURIComponent(fileName),
          partNumber,
          totalParts,
        };

        this.subiendoFoto = true;
        const result = await this.eventos.fotoCarnet(params);
        this.subiendoFoto = false;

        if (!result.success) {
          return {
            success: false,
            message: result.message || 'No se pudo validar el carnet. Intente nuevamente.',
          };
        }

        if (result.code === 202) {
          continue;
        }

        if (result.code === 200) {
          return {
            success: true,
            nombre: result.nombre,
            apellido1: result.apellido1,
            apellido2: result.apellido2,
            rut: result.rut,
          };
        }
      }

      return {
        success: false,
        message: 'No se pudo validar el carnet. Intente nuevamente.',
      };
    } catch (error) {
      console.error('Error al enviar foto del carnet', error);
      return {
        success: false,
        message: 'Ocurrió un error al enviar la imagen del carnet. Verifique su conexión e intente nuevamente.',
      };
    } finally {
      this.subiendoFoto = false;
    }
  }
 
  async volverAtras(){
    await this.nav.navigateBack(['/registrar-asistencia']);
    this.asistencia.solicitarRefreshEvento();
  }
  
  get nombre(){
    return this.form.get('nombre')
  }
  get correo(){
    return this.form.get('correo')
  }
  get rut(){
    return this.form.get('rut')
  }
}


