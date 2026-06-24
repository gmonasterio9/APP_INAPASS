import { Injectable } from '@angular/core';
import { DialogService } from 'src/app/services/dialog.service';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraPermissionType, CameraResultType, CameraSource, ImageOptions } from '@capacitor/camera';
import { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } from '@capacitor/barcode-scanner';
import { BehaviorSubject } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class UtilsService {

  constructor(private dialog: DialogService,
  ) { }

  esAppNativa(): boolean {
    return Capacitor.isNativePlatform();
  }

  esWeb(): boolean {
    return !Capacitor.isNativePlatform();
  }

  async tienePermisoCamara(): Promise<boolean> {
    if (this.esWeb()) {
      return true;
    }

    let permission = await Camera.checkPermissions();
    if (permission.camera === 'denied' || permission.camera === 'prompt') {
      permission = await Camera.requestPermissions({ permissions: ['camera' as CameraPermissionType] });
    }

    return permission.camera === 'granted' || permission.camera === 'limited';
  }

  obtenerOpcionesFotoCarnet(): ImageOptions {
    if (this.esAppNativa()) {
      return {
        quality: 90,
        source: CameraSource.Camera,
        resultType: CameraResultType.Base64,
      };
    }

    return {
      quality: 90,
      source: CameraSource.Prompt,
      resultType: CameraResultType.Base64,
      webUseInput: true,
      promptLabelHeader: 'Escanear carnet',
      promptLabelPhoto: 'Elegir de galería',
      promptLabelPicture: 'Tomar foto',
      promptLabelCancel: 'Cancelar',
    };
  }

  private intentosEstiloScanner = 0;
  private uiScannerWebActiva = false;

  async escanearCodigoQR(): Promise<string | undefined> {
    if (this.esWeb()) {
      await this.prepararScannerWeb();
    }

    try {
      const scanPromise = CapacitorBarcodeScanner.scanBarcode({
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
        web: { scannerFPS: 15 },
      });

      if (this.esWeb()) {
        this.activarDisenoScannerWeb();
      }

      const result = await scanPromise;
      return result?.ScanResult || undefined;
    } catch (error) {
      console.error('Error al escanear código QR', error);
      return undefined;
    } finally {
      if (this.esWeb()) {
        await this.finalizarScannerWeb();
      }
    }
  }

  private async prepararScannerWeb(): Promise<void> {
    this.intentosEstiloScanner = 0;
    this.uiScannerWebActiva = false;
    await this.detenerScannerWebActivo();
    document.getElementById('cap-os-barcode-scanner-container-scanner')?.replaceChildren();
    this.removerUiScannerWeb();
    document.getElementById('cap-os-barcode-scanner-container')?.classList.add('inapass-scanner');
  }

  private activarDisenoScannerWeb(): void {
    const dialog = document.getElementById('cap-os-barcode-scanner-container-dialog');
    const visible = dialog && dialog.style.display !== 'none';

    if (!visible) {
      if (++this.intentosEstiloScanner <= 30) {
        requestAnimationFrame(() => this.activarDisenoScannerWeb());
      }
      return;
    }

    if (this.uiScannerWebActiva) {
      return;
    }

    this.uiScannerWebActiva = true;
    dialog.style.display = 'flex';
    dialog.classList.add('inapass-scanner-active');
    document.getElementById('cap-os-barcode-scanner-container')?.classList.add('inapass-scanner');
    dialog.querySelector('.scanner-dialog-inner')?.classList.add('inapass-scanner-camera');

    if (!dialog.querySelector('.inapass-scanner-ui')) {
      const ui = document.createElement('div');
      ui.className = 'inapass-scanner-ui';
      ui.innerHTML = `
        <div class="inapass-scanner-header">Escanear código QR</div>
        <div class="inapass-scanner-footer">Apunta la cámara al código QR</div>
      `;
      dialog.appendChild(ui);
    }
  }

  private async detenerScannerWebActivo(): Promise<void> {
    const scanner = (window as Window & { OSBarcodeWebScanner?: { stop: () => Promise<void> } }).OSBarcodeWebScanner;
    if (!scanner) {
      return;
    }

    try {
      await scanner.stop();
    } catch {
      // El plugin a veces falla al limpiar nodos ya removidos.
    }

    (window as Window & { OSBarcodeWebScanner?: { stop: () => Promise<void> } }).OSBarcodeWebScanner = undefined;
  }

  private async finalizarScannerWeb(): Promise<void> {
    await this.detenerScannerWebActivo();
    document.getElementById('cap-os-barcode-scanner-container-scanner')?.replaceChildren();

    const dialog = document.getElementById('cap-os-barcode-scanner-container-dialog');
    if (dialog) {
      dialog.style.display = 'none';
      dialog.classList.remove('inapass-scanner-active');
    }

    this.removerUiScannerWeb();
    document.querySelector('.scanner-dialog-inner')?.classList.remove('inapass-scanner-camera');
    document.getElementById('cap-os-barcode-scanner-container')?.classList.remove('inapass-scanner');
    this.uiScannerWebActiva = false;
    this.intentosEstiloScanner = 0;
  }

  private removerUiScannerWeb(): void {
    document.querySelector('.inapass-scanner-ui')?.remove();
  }
  
  async showAlertCamera(header: string = 'Escanear Código QR') {
    if (this.esWeb()) {
      return this.dialog.showAlert({
        header,
        message: 'Permita el acceso a la cámara en su navegador para continuar.',
        buttons: [{ text: 'Aceptar', role: 'ok' }],
      });
    }

    const alert = await this.dialog.showAlert({
      header: header,
      message: 'Permitir que Ina-pass acceda a la cámara del dispositivo.',
      buttons: [
        {
          text: '"Abrir" Configuración',
          role: 'destructive',
        },
        {
          text: 'Cancelar',
          role: 'cancel'
        }
      ]
    });

    return alert;
  }
  async openLink(url: string) {
    return await Browser.open({ url: url });
  }

  private readonly rutMaxLength = 9;

  private limpiarRut(value: string): string {
    return value.replace(/[^0-9kK]/g, '').toUpperCase().slice(0, this.rutMaxLength);
  }

  formatearRut(value: string): string {
    const cleaned = this.limpiarRut(value);
    if (!cleaned) {
      return '';
    }
    if (cleaned.length <= 1) {
      return cleaned;
    }

    const dv = cleaned.slice(-1);
    const body = cleaned.slice(0, -1);
    const reversed = body.split('').reverse().join('');
    const withDots = reversed.match(/.{1,3}/g)?.join('.') ?? reversed;
    const formattedBody = withDots.split('').reverse().join('');

    return `${formattedBody}-${dv}`;
  }

  validarRut(value: string): boolean {
    const cleaned = value.replace(/\./g, '').replace(/-/g, '').toUpperCase();
    if (cleaned.length < 2 || cleaned.length > this.rutMaxLength) {
      return false;
    }

    const dv = cleaned.slice(-1);
    const body = cleaned.slice(0, -1);

    if (!/^\d+$/.test(body) || body.length < 1 || body.length > 8) {
      return false;
    }

    if (!/^[0-9K]$/.test(dv)) {
      return false;
    }

    let sum = 0;
    let multiplier = 2;

    for (let i = body.length - 1; i >= 0; i--) {
      sum += parseInt(body.charAt(i), 10) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }

    const remainder = 11 - (sum % 11);
    let expectedDv: string;

    if (remainder === 11) {
      expectedDv = '0';
    } else if (remainder === 10) {
      expectedDv = 'K';
    } else {
      expectedDv = `${remainder}`;
    }

    return dv === expectedDv;
  }

  readonly nombreMaxLength = 45;

  sanitizarNombre(value: string, maxLength = this.nombreMaxLength): string {
    const soloLetras = value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
    return soloLetras.slice(0, maxLength);
  }

  validarNombreSoloLetras(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) {
      return true;
    }
    return /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(trimmed);
  }

 
  resolverEstado(inicio: Date , fin: Date) {
    const now = new Date();
 
    if (!inicio || !fin) {
      return 'Fechas no disponibles';
    }
  
    if (now > inicio && now > fin) {
      return 'Evento Terminado';
    } else if (now < inicio && now < fin) {
      return 'Próximamente';
    } else {
      return 'Evento en proceso';
    }
  }

  private asistentesMap = new Map<string, BehaviorSubject<number>>();

  setAsistentes(eventId: string, valor: number) {
    const asistentes$ = this.getAsistentes(eventId);
    asistentes$.next(valor);
  }
  
  getAsistentes(eventId: string): BehaviorSubject<number> {
    if (!this.asistentesMap.has(eventId)) {
      this.asistentesMap.set(eventId, new BehaviorSubject(0));
    }
    return this.asistentesMap.get(eventId)!;
  }

  incrementarAsistente(eventId: string) {
    const asistentes$ = this.getAsistentes(eventId);
    const actual = Number(asistentes$.value);
    asistentes$.next(actual + 1);
  }
  
  divideBase64(base64: string, maxSize: number = 3 * 1024 * 1024): string[] {
    const chunkSize = Math.floor(maxSize * 4 / 3);
    const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
    const fragments: string[] = [];

    for (let i = 0; i < base64Data.length; i += chunkSize) {
      fragments.push(base64Data.substring(i, i + chunkSize));
    }

    return fragments;
  }

 

  buscarEnArray(buscar: string, campo: string, array: any[]): [boolean, string, boolean] {
    let encontrado = false;
    let registroId = '';
    let attendee = false;
 
    if(campo === 'qr'){
      for (const persona of array) {
        const decodedHtml = persona[campo].replace(/&amp;/g, '&');
        const url = decodedHtml.match(/src="([^"]+)"/)[1];
        const params = new URLSearchParams(url.split('?')[1]);
        const chl = params.get('chl');

      
        if(buscar === chl){
          encontrado = true;
          registroId = persona.eventRegistrationId;
          if(persona["invitationStatus"] === "Asistió a evento"){
            attendee = true;
          }
          break; 
        }
      }
    }
    
    else{
      const buscarNormalizado = buscar.toLocaleLowerCase().trim().replace(/\./g, '');
      for (const persona of array) {
        const campoNormalizado = persona[campo].toLocaleLowerCase().trim().replace(/\./g, '');
        if (campoNormalizado === buscarNormalizado) {
          encontrado = true;
          registroId = persona.eventRegistrationId;
          if(persona["invitationStatus"] === "Asistió a evento"){
            attendee = true;
          }
          break; 
        }
      }
    }
  
    return [encontrado, registroId, attendee];
  }
  separarNombre(nombreCompleto: string): [string, string] {
    const partes = nombreCompleto.trim().split(/\s+/);
    const total = partes.length;
  
    if (total === 0) {
      return ['', ''];
    }
  
    if (total === 1) {
      return [partes[0], ''];
    }
  
    if (total === 2) {
      return [partes[0], partes[1]];
    }
  
    const apellidos = partes.slice(-2).join(' ');
    const nombres = partes.slice(0, -2).join(' ');
    return [nombres, apellidos];
  }
}
