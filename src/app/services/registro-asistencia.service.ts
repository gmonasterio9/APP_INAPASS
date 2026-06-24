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
    await this.eventos.marcarAsistencia(registroId);
    this.asistenciaRegistrada$.next();
    this.eventoRefresh$.next();
    await this.mostrarAlertaConfirmando(evento, page);
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

  limpiarEventoActivo(): void {
    this.eventoActivo = null;
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
