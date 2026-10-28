import { Injectable } from '@angular/core';
import { EventosService } from './eventos.service';
import { UtilsService } from './utils.service';
import { DialogService } from './dialog.service';
import { Subject } from 'rxjs';
import { NavController } from '@ionic/angular';

export type RegistroResultado = {
  success: boolean;
  message?: string;
  header?: string;
  esDuplicado?: boolean;
};

@Injectable({
  providedIn: 'root'
})
export class RegistroAsistenciaService {
  asistenciaRegistrada$ = new Subject<void>();
  eventoRefresh$ = new Subject<void>();
  private eventoActivo: any = null;
  private sesionActiva: any = null;

  constructor(    
    private eventos: EventosService,
    private utils: UtilsService,
    private dialog: DialogService,
    private nav: NavController
  ) { }

  async registrarContactoYparticipante(bodyContacto: any, evento: string): Promise<RegistroResultado> {
    try {
      const contacto = await this.eventos.agregarLead(bodyContacto);
      if (contacto.success) {
        const participanteBody = this.crearParticipanteBody(contacto.data.nuevoLead.id, true, evento);
        return this.registrarParticipante(participanteBody, evento);
      }

      return {
        success: false,
        message: contacto.message || 'Debe ingresar un RUT válido',
      };
    } catch {
      return {
        success: false,
        message: 'No se pudo registrar el asistente. Verifique los datos ingresados.',
      };
    }
  }
  
  async registrarParticipante(participanteBody: any, evento: string): Promise<RegistroResultado> {
    try {
      const response = await this.eventos.agregarParticipante(participanteBody);
      if (response.success) {
        await this.marcarAsistencia(response.data.registroParticipante.IdRegistroDeEvento, evento);
        return { success: true };
      }

      return {
        success: false,
        message: response.message || 'No se pudo completar el registro del asistente.',
      };
    } catch {
      return {
        success: false,
        message: 'No se pudo completar el registro del asistente.',
      };
    }
  }

  crearParticipanteBody(idRegistro: string, esLead: boolean, idEvento: string) {
    return {
        CodigoEvento: idEvento,
        IdRegistro: idRegistro,
        EsLead: esLead,
    };
  }
  async actualizarYregistrar(bodyContacto: any, idContacto: string, evento:string, lead: boolean ): Promise<RegistroResultado> {
    try {
      if (lead){
        await this.eventos.actualizarLead(idContacto, bodyContacto);
      }
      else{
        await this.eventos.actualizarContacto(idContacto, bodyContacto);
      }
      const participanteBody = this.crearParticipanteBody(idContacto, lead, evento);
      return this.registrarParticipante(participanteBody, evento);
    } catch {
      return {
        success: false,
        message: 'No se pudo actualizar y registrar el asistente.',
      };
    }
  }

  crearBodyContacto(name: string, lastname: string, rut: string, correo: string, eventoArea: string, eventoSede: string): any {
    return {
      Personal_identification__c: rut,
      FirstName: name,
      LastName: lastname,
      Email: correo,
      businessArea__c: eventoArea,
      capturingBranch__c: eventoSede
    };
  }
  crearBodyCorreoContacto(correo: string): any {
    return {
      hed__AlternateEmail__c: correo,
      hed__Preferred_Email__c: "Alternate Email",
    };
  }
  crearBodyCorreoLead(correo: string): any {
    return {
      Email: correo,
    };
  }
  
  async marcarAsistencia(registroId: string, evento: string, page?: number){
    const idDelQR = `${registroId ?? ''}`.trim();
    const eventId = `${evento || this.eventoActivo?.Id || this.eventoActivo?.id || ''}`.trim();

    if (!idDelQR) {
      await this.dialog.dismissLoading();
      await this.dialog.showAlert({
        header: 'Código inválido',
        message: 'No se pudo leer el código QR. Intente escanearlo nuevamente.',
        buttons: [{ text: 'Aceptar', role: 'ok' }],
      });
      return;
    }

    if (!eventId) {
      await this.dialog.dismissLoading();
      await this.dialog.showAlert({
        header: 'Sin evento',
        message: 'No hay un evento activo. Cierre sesión e ingrese nuevamente con el PIN.',
        buttons: [{ text: 'Aceptar', role: 'ok' }],
      });
      return;
    }

    // 1) Elegir sesión → numeroSesion (int; no el Id Salesforce)
    const resultado = await this.cargarSesionActivaConDetalle(eventId);
    const numeroSesion = resultado.sesion?.numero ?? resultado.sesion?.Numero ?? null;

    await this.dialog.dismissLoading();

    if (numeroSesion == null || numeroSesion === '') {
      console.warn('[Inapass] sin numeroSesion', { eventId, idDelQR, detalle: resultado.mensaje });
      await this.dialog.showAlert({
        header: 'Sin sesión disponible',
        message: this.mensajeUsuarioSesion(resultado.mensaje),
        buttons: [{ text: 'Aceptar', role: 'ok' }],
      });
      return;
    }

    // 2) PATCH /sesion/{numeroSesion}/asistencia/{idDelQR}
    try {
      const response = await this.eventos.marcarAsistencia(numeroSesion, idDelQR);
      const body = response?.data ?? response;

      if (body?.success === false) {
        await this.dialog.showAlert({
          header: 'No se pudo registrar',
          message: this.mensajeUsuarioAsistencia(body.message),
          buttons: [{ text: 'Aceptar', role: 'ok' }],
        });
        return;
      }

      this.asistenciaRegistrada$.next();
      this.eventoRefresh$.next();
      await this.mostrarAlertaConfirmando(evento, page);
    } catch (error: any) {
      console.error('[Inapass] error marcar asistencia', error);
      const crudo = error?.data?.message || error?.data?.Message || error?.message;
      await this.dialog.showAlert({
        header: 'No se pudo registrar',
        message: this.mensajeUsuarioAsistencia(crudo),
        buttons: [{ text: 'Aceptar', role: 'ok' }],
      });
    }
  }

  solicitarRefreshEvento(): void {
    this.eventoRefresh$.next();
  }

  establecerEventoActivo(evento: any): void {
    if (evento) {
      this.eventoActivo = evento;
    }
  }

  obtenerEventoActivo(): any {
    return this.eventoActivo;
  }

  obtenerSesionActiva(): any {
    return this.sesionActiva;
  }

  limpiarEventoActivo(): void {
    this.eventoActivo = null;
    this.sesionActiva = null;
  }

  async cargarSesionActiva(eventId?: string): Promise<any | null> {
    return (await this.cargarSesionActivaConDetalle(eventId)).sesion;
  }

  private async cargarSesionActivaConDetalle(eventId?: string): Promise<{ sesion: any | null; mensaje?: string }> {
    const idEvento = `${eventId || this.eventoActivo?.Id || this.eventoActivo?.id || ''}`.trim();
    if (!idEvento) {
      this.sesionActiva = null;
      return { sesion: null, mensaje: 'sin-evento' };
    }

    try {
      console.log('[Inapass] consultando sesiones eventId=', idEvento);
      const response = await this.eventos.getSesiones(idEvento);
      console.log('[Inapass] respuesta sesiones=', response);

      const data = response?.data;
      const records = Array.isArray(data?.records) && data.records.length
        ? data.records
        : Array.isArray(data?.sesiones)
          ? data.sesiones
          : [];

      console.log('[Inapass] sesiones records=', records.length, records);

      if (!response?.success) {
        this.sesionActiva = null;
        return {
          sesion: null,
          mensaje: response?.message || 'error-sesiones',
        };
      }

      if (!records.length) {
        this.sesionActiva = null;
        return {
          sesion: null,
          mensaje: 'sin-sesiones',
        };
      }

      this.sesionActiva = this.seleccionarSesion(records);
      console.log(
        '[Inapass] sesión elegida numero=',
        this.sesionActiva?.numero ?? this.sesionActiva?.Numero,
        'id=',
        this.sesionActiva?.Id ?? this.sesionActiva?.id ?? this.sesionActiva?.idSesion,
      );
      return { sesion: this.sesionActiva };
    } catch (error: any) {
      console.error('Error al cargar sesiones', error);
      this.sesionActiva = null;
      const crudo = `${error?.data?.message || error?.message || ''}`.toLowerCase();
      const red = /failed to fetch|network|timeout|err_connection|load failed/.test(crudo);
      return {
        sesion: null,
        mensaje: red ? 'error-red' : 'error-sesiones',
      };
    }
  }

  /** Mensajes amigables; detalle técnico solo en consola. */
  private mensajeUsuarioSesion(codigoOMensaje?: string): string {
    const key = `${codigoOMensaje || ''}`.trim().toLowerCase();
    if (key === 'sin-sesiones' || key.includes('no tiene sesiones')) {
      return 'Este evento no tiene sesiones activas para registrar asistencia. Consulte al encargado del evento.';
    }
    if (key === 'error-red' || key.includes('failed to fetch')) {
      return 'No hay conexión con el servidor. Verifique su red e intente nuevamente.';
    }
    if (key === 'sin-evento') {
      return 'No hay un evento activo. Cierre sesión e ingrese nuevamente con el PIN.';
    }
    // Mensaje de negocio del API (si viene en español y es corto)
    if (codigoOMensaje && !this.esMensajeTecnico(codigoOMensaje)) {
      return codigoOMensaje;
    }
    return 'No se pudo obtener la sesión del evento. Intente más tarde o consulte al encargado.';
  }

  private mensajeUsuarioAsistencia(crudo?: string): string {
    if (crudo && !this.esMensajeTecnico(crudo)) {
      return crudo;
    }
    return 'No se pudo registrar la asistencia. Intente nuevamente.';
  }

  private esMensajeTecnico(texto: string): boolean {
    const t = `${texto}`;
    return /GET \/|PATCH \/|POST \/|api\/v1|Failed to fetch|MessageDetail|System\.|NULL|numeroSesion|idDelQR|eventId=|Event_Session|stack|exception/i.test(t)
      || t.trim().startsWith('{')
      || t.length > 220;
  }

  private seleccionarSesion(sesiones: any[]): any {
    const ahora = Date.now();
    const conFechas = sesiones.map((sesion) => {
      const inicioRaw = sesion.Session_Start_Date__c ?? sesion.inicio;
      const finRaw = sesion.Session_End_Date__c ?? sesion.termino;
      const inicio = new Date(inicioRaw).getTime();
      const fin = new Date(finRaw).getTime();
      return { sesion, inicio, fin };
    }).filter((item) => !Number.isNaN(item.inicio) && !Number.isNaN(item.fin));

    if (!conFechas.length) {
      return sesiones[0];
    }

    const enCurso = conFechas
      .filter((item) => ahora >= item.inicio && ahora <= item.fin)
      .sort((a, b) => b.inicio - a.inicio);
    if (enCurso.length) {
      return enCurso[0].sesion;
    }

    const proximas = conFechas
      .filter((item) => item.inicio > ahora)
      .sort((a, b) => a.inicio - b.inicio);
    if (proximas.length) {
      return proximas[0].sesion;
    }

    return conFechas.sort((a, b) => b.fin - a.fin)[0].sesion;
  }
  
  async mostrarAlertaConfirmando(evento: string, page?: number){
    await this.dialog.showAlert({
      header: 'Registro Confirmado',
      message: 'Asistente registrado correctamente al evento',
      buttons:[
        {
          text:'Aceptar',
          role: 'ok',
          handler: () => {
            if (!page) {
              this.eventoRefresh$.next();
              this.nav.navigateBack(['/registrar-asistencia']);
            }
          }
        }
      ]
    })
  }
  async mostrarAlertaDuplicado() {
    await this.dialog.showAlert({
      header: 'Registro Duplicado',
      message: 'El asistente ya ha realizado su registro para este evento.',
      buttons: [
        {
          text: 'Aceptar',
          role: 'ok',
        }
      ]
    });
  }
  async alertaError(){
    await this.dialog.showAlert({
      header: 'Error en formulario',
      message: 'El Rut ingresado no es válido',
      buttons:[
        {
          text:'Aceptar',
          role: 'ok',
        }
      ]
    })
  }
  
}
