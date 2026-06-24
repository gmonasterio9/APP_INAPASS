import { Injectable } from '@angular/core';
import { CapacitorHttp, HttpOptions } from '@capacitor/core';
import { environment } from 'src/environments/environment';
import { Preferences } from '@capacitor/preferences';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class EventosService {
  baseUrl: string;
  constructor(private auth: AuthService) { 
    this.baseUrl = `${environment.apiUrl}/api/v1`
  }

  public get = async (url: string) => {
    const auth = await this.auth.getAuth();
    if (auth == null) {
      throw Error('ACCESS_TOKEN_MISSING');
    }
    const options: HttpOptions = {
      url: url,
      responseType: 'json',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`
      },
    };

    try {
      const response = await CapacitorHttp.get(options);
      if (response.status == 200) {
        return response.data;
      } else {
        return Promise.reject(response);
      }
    }
    catch (error) {
      return Promise.reject(error);
    }
  }
  private async getHeaders(needsAuth: boolean = true) {
    const headers: any = {
      'Content-Type': 'application/json',
    };
    
    if (needsAuth) {
      const auth = await this.auth.getAuth();
      if (auth) {
        headers['Authorization'] = `Bearer ${auth.token}`;
      } 
      else {
        throw Error('ACCESS_TOKEN_MISSING');
      }
    }

    return headers;
  }

  public post = async (url: string, params: any, needsAuth: boolean = true) => {
    const headers = await this.getHeaders(needsAuth);

    const options: HttpOptions = {
      method: 'post',
      url: url,
      responseType: 'json',
      headers,
      data: params
    };

    try {
      const response = await CapacitorHttp.post(options);

      if (response.status == 200) {
        return response.data;
      } else {
        return Promise.reject(response);
      }
    }
    catch (error) {
      return Promise.reject(error);
    }
  }
  public patch = async (url: string, params?: any) => {
    const auth = await this.auth.getAuth();
    if (auth == null) {
      throw Error('ACCESS_TOKEN_MISSING');
    }
    const options: HttpOptions = {
      method: 'patch',
      url: url,
      responseType: 'json',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`
      },
      data: params
    };

    try {
      const response = await CapacitorHttp.patch(options);

      if (response.status == 200) {
        return response;
      } else {
        return Promise.reject(response);
      }
    }
    catch (error) {
      return Promise.reject(error);
    }
  }

  public delete = async (url: string, params?: any) => {
    const auth = await this.auth.getAuth();
    if (auth == null) {
      throw Error('ACCESS_TOKEN_MISSING');
    }
    const options: HttpOptions = {
      url: url,
      method: 'delete',
      responseType: 'json',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`
      },
      data: params || {}
    };

    const response = await CapacitorHttp.delete(options);

    if (response.status == 200) {
      return response.data;
    }

    return Promise.reject(response);
  }
  
  getEventos(){
    return this.get(`${this.baseUrl}/eventos`);
  }
  getParticipante(eventId: string){
    return this.get(`${this.baseUrl}/evento/participantes?eventId=${eventId}`);
  }
  getEsLead(rut: string){
    return this.get(`${this.baseUrl}/evento/es-lead?rut=${rut}`);
  }
  getEsContacto(rut: string){
    return this.get(`${this.baseUrl}/evento/es-contacto?rut=${rut}`);
  }
  agregarParticipante(params: any){
    return this.post(`${this.baseUrl}/crear-participante`, params);
  }
  agregarLead(params: any){
    return this.post(`${this.baseUrl}/crear-lead`, params);
  }
  marcarAsistencia(idParticipante: string){
    return this.patch(`${this.baseUrl}/marcar-asistencia/${idParticipante}`);
  }
  loginValidation(params: any){
    return this.post(`${this.baseUrl}/login`, params, false);
  }
  fotoCarnet(params: any){
    return this.post(`${this.baseUrl}/cargar-foto-cedula`, params);
  }
  getCredencial(token: string){
    return this.get(`${this.baseUrl}/info-credencial?token=${token}`)
  }
  actualizarContacto(idContacto: string, params: any){
    return this.patch(`${this.baseUrl}/contacto/${idContacto}`, params);
  }
  actualizarLead(idLead: string, params: any){
    return this.patch(`${this.baseUrl}/lead/${idLead}`, params);
  }
  datosContacto(idContacto: string){
    return this.get(`${this.baseUrl}/evento/contacto?idContacto=${idContacto}`)
  }
  datosLead(idContacto: string){
    return this.get(`${this.baseUrl}/evento/lead?idLead=${idContacto}`)
  }
}