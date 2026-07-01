import { Component, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { NavController, Platform, ViewWillEnter, ViewWillLeave } from '@ionic/angular';
import { UtilsService } from 'src/app/services/utils.service';
import { DialogService } from 'src/app/services/dialog.service';
import { EventosService } from '../services/eventos.service';
import { Subscription } from 'rxjs';
import { DatosExistentesModalComponent } from '../components/datos-existentes-modal/datos-existentes-modal.component';
import { RegistroAsistenciaService } from '../services/registro-asistencia.service';
import { AuthService } from '../services/auth.service';


@Component({
  selector: 'app-registrar-asistencia',
  templateUrl: './registrar-asistencia.page.html',
  styleUrls: ['./registrar-asistencia.page.scss'],
  standalone: false,
})
export class RegistrarAsistenciaPage implements OnDestroy, ViewWillEnter, ViewWillLeave {

  evento: any;
  registros: any[] = [];
  contadorAsistentes: number | null = null;
  readonly imagenEvento = 'assets/images/imagen_evento.png';
  state: any = {};
  private asistenciaSub?: Subscription;
  private refreshSub?: Subscription;
  private backButtonSub?: Subscription;
  intervalId?: ReturnType<typeof setInterval>;
  escaneandoQR = false;

  constructor(private router: Router,
    private pt: Platform,
    private utils: UtilsService,
    private dialog: DialogService,
    private eventos: EventosService,
    private nav: NavController,
    private asistencia: RegistroAsistenciaService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
  ) {
    const eventoNavegacion = this.router.getCurrentNavigation()?.extras.state;
    this.evento = eventoNavegacion ?? this.asistencia.obtenerEventoActivo();
    if (this.evento) {
      this.asistencia.establecerEventoActivo(this.evento);
    }
    this.contadorAsistentes = this.extraerTotalAsistentes(this.evento);
  }

  ingresoManual(rut?: string) {
    this.state = {
      eventId: this.evento.Id,
      eventArea: this.evento.businessArea__c,
      capturingBranch__c: this.evento.organizingHeadquarters__c
    };

    if (rut) {
      this.state.rut = rut;
    }
    this.nav.navigateForward(['/registro-manual'], { state: this.state });
  }

  async ionViewWillEnter() {
    if (!this.evento) {
      this.evento = this.asistencia.obtenerEventoActivo();
    }
    this.suscribirEventosAsistencia();
    await this.iniciarPantalla();
  }

  private async iniciarPantalla(): Promise<void> {
    try {
      if (!this.obtenerEventoId()) {
        await this.actualizarContador();
      }

      if (!this.obtenerEventoId()) {
        return;
      }

      if (this.intervalId) {
        clearInterval(this.intervalId);
      }

      await this.refrescarDatosEvento();

      this.intervalId = setInterval(() => {
        void this.refrescarDatosEvento();
      }, 15000);

      this.backButtonSub?.unsubscribe();
      this.backButtonSub = this.pt.backButton.subscribeWithPriority(10, () => {
        this.tapLogout();
      });
    } catch (error) {
      console.error('Error al cargar evento', error);
      await this.dialog.dismissLoading();
    }
  }

  private obtenerEventoId(): string {
    return `${this.evento?.Id ?? this.evento?.id ?? ''}`;
  }

  private buscarEventoEnRespuesta(response: any): any | null {
    const eventosData = response?.data?.eventos;
    if (!eventosData) {
      return null;
    }

    const candidatos: any[] = [];
    if (Array.isArray(eventosData.records)) {
      candidatos.push(...eventosData.records);
    }
    if (Array.isArray(eventosData.listadoEventos)) {
      candidatos.push(...eventosData.listadoEventos);
    }

    if (!candidatos.length) {
      return null;
    }

    const eventoId = this.obtenerEventoId();
    if (!eventoId) {
      return candidatos[0];
    }

    return candidatos.find((evento) =>
      [evento.Id, evento.id, evento.eventId].includes(eventoId)
    ) ?? candidatos[0];
  }

  private extraerTotalAsistentes(evento: any): number | null {
    const total = evento?.totalAtendee__c
      ?? evento?.TotalAttendee__c
      ?? evento?.totalAttendees
      ?? evento?.totalAttendee;

    if (total === undefined || total === null || total === '') {
      return null;
    }

    return Number(total);
  }

  get eventoListo(): boolean {
    return !!(this.evento?.Name && this.evento?.Event_Start_Date__c && this.evento?.Event_End_Date__c);
  }

  async refrescarDatosEvento(): Promise<void> {
    if (!this.evento) {
      this.evento = this.asistencia.obtenerEventoActivo();
    }

    await Promise.all([
      this.actualizarContador(),
      this.actualizarParticipantes(),
    ]);
    this.ngZone.run(() => this.cdr.detectChanges());
  }

  async handleRefresh(event: CustomEvent): Promise<void> {
    try {
      await this.refrescarDatosEvento();
    } catch (error) {
      console.error('Error al refrescar evento', error);
    } finally {
      (event.target as HTMLIonRefresherElement).complete();
    }
  }

  private aplicarEventoActualizado(eventoActualizado: any): void {
    if (!this.evento) {
      this.evento = { ...eventoActualizado };
    } else {
      this.evento = {
        ...this.evento,
        Id: eventoActualizado.Id ?? this.evento.Id,
        Name: eventoActualizado.Name ?? this.evento.Name,
        Event_Start_Date__c: eventoActualizado.Event_Start_Date__c ?? this.evento.Event_Start_Date__c,
        Event_End_Date__c: eventoActualizado.Event_End_Date__c ?? this.evento.Event_End_Date__c,
        businessArea__c: eventoActualizado.businessArea__c ?? this.evento.businessArea__c,
        organizingHeadquarters__c: eventoActualizado.organizingHeadquarters__c ?? this.evento.organizingHeadquarters__c,
        Maximum_Registration__c: eventoActualizado.Maximum_Registration__c ?? this.evento.Maximum_Registration__c,
      };
    }

    this.asistencia.establecerEventoActivo(this.evento);

    const total = this.extraerTotalAsistentes(eventoActualizado);
    if (total !== null) {
      this.evento.totalAtendee__c = total;
      this.evento.TotalAttendee__c = total;
      this.contadorAsistentes = total;
    }
  }

  async actualizarParticipantes(): Promise<void> {
    try {
      const eventoId = this.obtenerEventoId();
      if (!eventoId) {
        return;
      }

      const response = await this.eventos.getParticipante(eventoId);
      if (response.success) {
        this.registros = response.data.participantes;
      }
    } catch (err) {
      console.error('Error actualizando participantes', err);
    }
  }

 async actualizarContador() {
  try {
    const response = await this.eventos.getEventos();
    if (!response.success) {
      return;
    }

    const eventoActualizado = this.buscarEventoEnRespuesta(response);
    if (!eventoActualizado) {
      return;
    }

    this.aplicarEventoActualizado(eventoActualizado);
  } catch (err) {
    console.error('Error actualizando contador', err);
  }
}

  private suscribirEventosAsistencia(): void {
    this.asistenciaSub?.unsubscribe();
    this.refreshSub?.unsubscribe();

    this.asistenciaSub = this.asistencia.asistenciaRegistrada$.subscribe(() => {
      void this.refrescarDatosEvento();
    });
    this.refreshSub = this.asistencia.eventoRefresh$.subscribe(() => {
      void this.refrescarDatosEvento();
    });
  }

  private detenerRecursosPantalla(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.backButtonSub?.unsubscribe();
    this.backButtonSub = undefined;
    this.asistenciaSub?.unsubscribe();
    this.asistenciaSub = undefined;
    this.refreshSub?.unsubscribe();
    this.refreshSub = undefined;
  }

  ionViewWillLeave() {
    this.detenerRecursosPantalla();
  }

  ngOnDestroy() {
    this.detenerRecursosPantalla();
  }

  async escanearTap() {
    if (this.escaneandoQR) {
      return;
    }

    const tienePermiso = await this.utils.tienePermisoCamara();
    if (!tienePermiso) {
      await this.utils.showAlertCamera();
      return;
    }

    this.escaneandoQR = true;
    try {
      const barcode = await this.utils.escanearCodigoQR();
      if (!barcode) {
        return;
      }

      await this.dialog.showLoading({ message: 'Procesando...' });

      let tipoQR = 'entrada'
      let rut = '';
      let invitado = false;
      let registroId: any;
      let attendee = false;
      let nombre = '';
      let correo = '';

      let posicionInicial = barcode.indexOf('RUN=');
      await this.actualizarParticipantes();
      //Carnet
      if(posicionInicial != -1){
        let inicio = barcode.substring(posicionInicial + 'RUN='.length).trim();
        let posicionFinal = inicio.indexOf("&");
        rut = inicio.substring(0, posicionFinal).trim();
        tipoQR = 'carnet';
        [invitado, registroId, attendee] = this.utils.buscarEnArray(rut, "identificationNumber", this.registros);
      }
      else{
        const regex = /^a12Vt/;
        if (regex.test(barcode)) {
          [invitado, registroId, attendee] = this.utils.buscarEnArray(barcode, "qr", this.registros);
        }
        else {
          const datosCredencial = await this.eventos.getCredencial(barcode);
          if (datosCredencial.success){
            rut = datosCredencial.data.rut;
            nombre = datosCredencial.data.nombre;
            correo = datosCredencial.data.correo;
            tipoQR = 'credencial';
            [invitado, registroId, attendee] = this.utils.buscarEnArray(rut, "identificationNumber", this.registros);
          }
        }
      }
      if (attendee) {
        await this.dialog.dismissLoading();
        await this.asistencia.mostrarAlertaDuplicado();
      }
      else {
        const args = [rut, invitado, registroId, tipoQR] as const;
        await this.procesarRegistro(...args);
      }
    }catch(error){
      console.error('Error en el proceso de escaneo:', error);
    }finally{
      this.escaneandoQR = false;
      await this.dialog.dismissLoading();
    }
  }

  estado(inicio: string, fin: string): string{
    const inicioDate = new Date(inicio);
    const finDate= new Date(fin);
    return this.utils.resolverEstado(inicioDate, finDate);
  }
  formatearFecha(fechaISO: string): string {
    const fecha = new Date(fechaISO);
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();

    return `${dia}/${mes}/${anio}`;
  }


  async mostrarAlertaRechazado(rut?: string){
    await this.dialog.showAlert({
      header: 'Código no encontrado',
      message: 'El código QR escaneado no pertenece a ninguno de los asistentes registrados previamente',
      buttons:[
        {
          text:'Registrar Manualmente',
          role: 'destructive',
          handler: () => {
            if (rut && rut.trim() !== '') {
              this.ingresoManual(rut);
            } else {
              this.ingresoManual();
            }
          }
        },
        {
          text:'Cancelar',
          role: 'cancel'
        }
      ]
    })
  }

  async mostrarModalDatosExistentes(eventoID: string, nombreContacto: string, apellidoContacto: string, rutContacto: string, correoContacto: string, participanteBody: any): Promise<string | undefined> {
    const element = await this.dialog.showModal({
      component: DatosExistentesModalComponent,
      cssClass: 'modal-fullscreen',
      showBackdrop: true,
      animated: false,
      componentProps: {
        evento: eventoID,
        participanteBody: participanteBody,
        nombreContacto,
        apellidoContacto,
        rutContacto,
        correoContacto,
      }
    });

    return new Promise<string | undefined>((resolve) => {
      element.onDidDismiss().then((result) => {
        const datoSeleccionado: string | undefined = result.data?.dato;
        resolve(datoSeleccionado);
      });
    });
  }


  async procesarRegistro(rut: string, invitado: boolean, registroId: string, tipoQR: string) {

    if (invitado) {
      await this.asistencia.marcarAsistencia(registroId, this.evento.Id, 1);
      return;
    }

    if (tipoQR !== 'entrada') {

      const rutConsulta = rut.replace(/\./g, "");
      const eslead = await this.eventos.getEsLead(rutConsulta);
      let participanteBody: any = null;
      if(eslead.success){

        if (eslead.data.lead.totalSize !== 0) {
          participanteBody = this.asistencia.crearParticipanteBody(eslead.data.lead.records[0].Id, true, this.evento.Id);
        }

        else{
          const escontacto = await this.eventos.getEsContacto(rutConsulta);
          if (escontacto.success){
            if (escontacto.data.contacto.totalSize !== 0) {
              participanteBody = this.asistencia.crearParticipanteBody(escontacto.data.contacto.records[0].Id, false, this.evento.Id);
            }
          }
        }

      }

      if (participanteBody) {

        const idContacto = participanteBody.IdRegistro;
        const datosContactos = await this.eventos.datosContacto(idContacto);

        if (datosContactos.success){
          const nombreContacto = datosContactos.data.contacto.FirstName
          const apellidoContacto = datosContactos.data.contacto.LastName
          const rutContacto = datosContactos.data.contacto.Personal_identification__c
          const correoContacto = datosContactos.data.contacto.hed__AlternateEmail__c
          await this.dialog.dismissLoading();

          const datoSeleccionado = await this.mostrarModalDatosExistentes(
            this.evento.Id,
            nombreContacto,
            apellidoContacto,
            rutContacto,
            correoContacto,
            participanteBody
          );
        }
      }
      else {
          await this.dialog.dismissLoading();
          this.mostrarAlertaRechazado(rut);
      }
    }
    else{
      await this.dialog.dismissLoading();
      this.mostrarAlertaRechazado();
    }
  }

  async tapLogout(){
    const confirmado = await this.dialog.confirmarSalidaSesion();
    if (!confirmado) {
      return;
    }

    this.detenerRecursosPantalla();
    await this.auth.clearAuth();
    this.asistencia.limpiarEventoActivo();
    this.router.navigate(['/home'], { queryParams: { logout: true } });
  }

}
