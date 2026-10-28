import { Injectable } from '@angular/core';
import { DialogService } from 'src/app/services/dialog.service';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraPermissionType, CameraResultType, CameraSource, ImageOptions } from '@capacitor/camera';
import { CapacitorBarcodeScanner, CapacitorBarcodeScannerCameraDirection, CapacitorBarcodeScannerTypeHint } from '@capacitor/barcode-scanner';
import { Html5Qrcode } from 'html5-qrcode';
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
      if (!navigator?.mediaDevices?.getUserMedia) {
        return false;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: this.restriccionesVideoCamara(true),
          audio: false,
        });
        stream.getTracks().forEach((t) => t.stop());
        return true;
      } catch {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          stream.getTracks().forEach((t) => t.stop());
          return true;
        } catch {
          return false;
        }
      }
    }

    let permission = await Camera.checkPermissions();
    if (permission.camera === 'denied' || permission.camera === 'prompt') {
      permission = await Camera.requestPermissions({ permissions: ['camera' as CameraPermissionType] });
    }

    return permission.camera === 'granted' || permission.camera === 'limited';
  }

  /** Tablets / equipos con poca RAM o CPU. */
  dispositivoLimitado(): boolean {
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { saveData?: boolean; effectiveType?: string };
    };
    const cores = navigator.hardwareConcurrency || 4;
    const mem = nav.deviceMemory;
    const saveData = !!nav.connection?.saveData;
    const redLenta = /2g/.test(nav.connection?.effectiveType || '');
    const tablet =
      window.matchMedia('(min-width: 600px) and (pointer: coarse)').matches
      || /iPad|Tablet|Android(?!.*Mobile)/i.test(navigator.userAgent);

    if (mem != null && mem <= 2) {
      return true;
    }
    if (cores <= 2) {
      return true;
    }
    if (tablet && (cores <= 4 || (mem != null && mem <= 4))) {
      return true;
    }
    return saveData || redLenta;
  }

  private restriccionesVideoCamara(facingEnvironment = true): MediaTrackConstraints {
    const limitado = this.dispositivoLimitado();
    return {
      facingMode: facingEnvironment ? { ideal: 'environment' } : { ideal: 'user' },
      width: limitado ? { ideal: 640, max: 960 } : { ideal: 1280, max: 1920 },
      height: limitado ? { ideal: 480, max: 720 } : { ideal: 720, max: 1080 },
      frameRate: limitado ? { ideal: 10, max: 15 } : { ideal: 15, max: 24 },
    };
  }

  obtenerOpcionesFotoCarnet(): ImageOptions {
    const quality = this.dispositivoLimitado() ? 65 : 85;
    const width = this.dispositivoLimitado() ? 1280 : 1920;

    if (this.esAppNativa()) {
      return {
        quality,
        width,
        source: CameraSource.Camera,
        resultType: CameraResultType.Base64,
        correctOrientation: true,
      };
    }

    return {
      quality,
      width,
      source: CameraSource.Prompt,
      resultType: CameraResultType.Base64,
      correctOrientation: true,
      webUseInput: true,
      promptLabelHeader: 'Escanear carnet',
      promptLabelPhoto: 'Elegir de galería',
      promptLabelPicture: 'Tomar foto',
      promptLabelCancel: 'Cancelar',
    };
  }

  private intentosEstiloScanner = 0;
  private uiScannerWebActiva = false;
  private scannerWeb?: Html5Qrcode;

  async escanearCodigoQR(): Promise<string | undefined> {
    if (this.esWeb()) {
      return this.escanearCodigoQRWeb();
    }

    try {
      const result = await CapacitorBarcodeScanner.scanBarcode({
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
        cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
      });
      return result?.ScanResult || undefined;
    } catch (error) {
      console.error('Error al escanear código QR', error);
      return undefined;
    }
  }

  private escanearCodigoQRWeb(): Promise<string | undefined> {
    return new Promise((resolve) => {
      void this.iniciarScannerWeb(resolve);
    });
  }

  private async iniciarScannerWeb(resolve: (value: string | undefined) => void): Promise<void> {
    await this.detenerScannerWebActivo();
    this.construirScannerWeb();
    this.mostrarScannerWeb();

    const elementId = 'cap-os-barcode-scanner-container-scanner';
    const scannerEl = document.getElementById(elementId);
    if (!scannerEl) {
      resolve(undefined);
      return;
    }

    scannerEl.replaceChildren();
    this.scannerWeb = new Html5Qrcode(elementId, { verbose: false });

    let finalizado = false;
    const cerrar = async (resultado?: string) => {
      if (finalizado) {
        return;
      }
      finalizado = true;
      await this.finalizarScannerWeb();
      resolve(resultado);
    };

    const closeButton = document.getElementById('cap-os-barcode-scanner-close-button');
    if (closeButton) {
      closeButton.onclick = () => void cerrar(undefined);
    }

    const limitado = this.dispositivoLimitado();
    const minEdge = Math.min(window.innerWidth, window.innerHeight);
    const qrSize = Math.min(
      limitado ? 220 : 280,
      Math.max(limitado ? 160 : 200, Math.floor(minEdge * (limitado ? 0.55 : 0.68))),
    );

    const configBase = {
      fps: limitado ? 8 : 12,
      qrbox: { width: qrSize, height: qrSize },
      aspectRatio: 1.0,
      disableFlip: limitado,
    };

    const onSuccess = (decodedText: string) => void cerrar(decodedText);
    const onError = () => { /* sin código en este frame */ };

    type IntentoCamara = { camara: string | MediaTrackConstraints; videoConstraints?: MediaTrackConstraints };
    const intentos: IntentoCamara[] = [];

    try {
      const devices = await Html5Qrcode.getCameras();
      const trasera = devices.find((d) => /back|rear|trasera|environment|posterior/i.test(d.label));
      const elegida = trasera?.id || devices[0]?.id;
      if (elegida) {
        intentos.push({
          camara: elegida,
          videoConstraints: limitado
            ? { width: { ideal: 640, max: 960 }, height: { ideal: 480, max: 720 }, frameRate: { ideal: 10, max: 15 } }
            : undefined,
        });
      }
    } catch (error) {
      console.warn('No se listaron cámaras', error);
    }

    intentos.push(
      { camara: this.restriccionesVideoCamara(true) },
      { camara: { facingMode: 'environment' } },
      { camara: this.restriccionesVideoCamara(false) },
      { camara: { facingMode: 'user' } },
    );

    for (const intento of intentos) {
      try {
        const cfg = {
          ...configBase,
          ...(intento.videoConstraints ? { videoConstraints: intento.videoConstraints } : {}),
        };
        await this.scannerWeb.start(intento.camara as any, cfg, onSuccess, onError);
        return;
      } catch (error) {
        console.warn('No se pudo iniciar cámara', intento.camara, error);
        try {
          if (this.scannerWeb?.isScanning) {
            await this.scannerWeb.stop();
          }
        } catch {
          // ignore
        }
      }
    }

    await cerrar(undefined);
    await this.dialog.showAlert({
      header: 'Cámara no disponible',
      message: 'No se pudo iniciar la cámara en este dispositivo. Pruebe acercar más el código o use ingreso manual.',
      buttons: [{ text: 'Aceptar', role: 'ok' }],
    });
  }

  private construirScannerWeb(): void {
    let container = document.getElementById('cap-os-barcode-scanner-container');
    if (container) {
      container.className = 'inapass-scanner scanner-container-display';
      const dialog = document.getElementById('cap-os-barcode-scanner-container-dialog');
      if (dialog) {
        dialog.style.display = 'flex';
      }
      return;
    }

    container = document.body.appendChild(document.createElement('div'));
    container.id = 'cap-os-barcode-scanner-container';
    container.className = 'inapass-scanner scanner-container-display';

    const dialog = document.createElement('div');
    dialog.id = 'cap-os-barcode-scanner-container-dialog';
    dialog.className = 'scanner-dialog';

    const inner = document.createElement('div');
    inner.className = 'scanner-dialog-inner inapass-scanner-camera';

    const closeButton = document.createElement('span');
    closeButton.id = 'cap-os-barcode-scanner-close-button';
    closeButton.className = 'close-button';
    closeButton.innerHTML = '&times;';
    inner.appendChild(closeButton);

    const scannerHost = document.createElement('div');
    scannerHost.className = 'scanner-container-full-width';
    scannerHost.id = 'cap-os-barcode-scanner-container-scanner';
    inner.appendChild(scannerHost);

    dialog.appendChild(inner);
    container.appendChild(dialog);
  }

  private mostrarScannerWeb(): void {
    const dialog = document.getElementById('cap-os-barcode-scanner-container-dialog');
    if (dialog) {
      dialog.style.display = 'flex';
    }
    this.intentosEstiloScanner = 0;
    this.uiScannerWebActiva = false;
    this.activarDisenoScannerWeb();
  }

  private async detenerScannerWebActivo(): Promise<void> {
    if (this.scannerWeb) {
      try {
        if (this.scannerWeb.isScanning) {
          await this.scannerWeb.stop();
        }
        await this.scannerWeb.clear();
      } catch {
        // El scanner a veces falla al limpiar nodos ya removidos.
      }
      this.scannerWeb = undefined;
    }

    const legacyScanner = (window as Window & { OSBarcodeWebScanner?: { stop: () => Promise<void> } }).OSBarcodeWebScanner;
    if (legacyScanner) {
      try {
        await legacyScanner.stop();
      } catch {
        // ignore
      }
      (window as Window & { OSBarcodeWebScanner?: { stop: () => Promise<void> } }).OSBarcodeWebScanner = undefined;
    }
  }

  private activarDisenoScannerWeb(): void {
    const dialog = document.getElementById('cap-os-barcode-scanner-container-dialog');
    if (!dialog) {
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
    document.getElementById('cap-os-barcode-scanner-container')?.classList.remove('inapass-scanner', 'scanner-container-display');
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
      message: 'Permitir que Inapass acceda a la cámara del dispositivo.',
      buttons: [
        {
          text: 'Abrir Configuración',
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

  esQrColaborador(texto: string): boolean {
    const value = `${texto ?? ''}`;
    if (/BEGIN:VCARD/i.test(value)) {
      return true;
    }
    return /Nombre\s*:/i.test(value) && /Correo electr[oó]nico\s*:/i.test(value);
  }

  parsearQrColaborador(texto: string): {
    nombre: string;
    correo: string;
    telefono: string;
    empresa: string;
    titulo: string;
  } {
    const value = `${texto ?? ''}`.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    if (/BEGIN:VCARD/i.test(value)) {
      const extraerVcard = (campo: string): string => {
        const regex = new RegExp(`^${campo}(?:;[^:]*)?:(.+)$`, 'im');
        const match = value.match(regex);
        return match?.[1]?.trim() ?? '';
      };

      const fn = extraerVcard('FN');
      const n = extraerVcard('N');
      let nombre = fn;
      if (!nombre && n) {
        // N:Apellidos;Nombre;...
        const partes = n.split(';');
        const apellidos = partes[0]?.trim() ?? '';
        const nombres = partes[1]?.trim() ?? '';
        nombre = `${nombres} ${apellidos}`.trim();
      }

      return {
        nombre,
        correo: extraerVcard('EMAIL').toLowerCase(),
        telefono: extraerVcard('TEL'),
        empresa: extraerVcard('ORG'),
        titulo: extraerVcard('TITLE'),
      };
    }

    const extraer = (label: string): string => {
      const regex = new RegExp(`${label}\\s*:\\s*(.+)`, 'i');
      const match = value.match(regex);
      return match?.[1]?.trim() ?? '';
    };

    const correoRaw = extraer('Correo electr[oó]nico');
    const telefonoRaw = extraer('N[uú]mero');

    return {
      nombre: extraer('Nombre'),
      correo: correoRaw.replace(/\s*\([^)]*\)\s*/g, '').trim().toLowerCase(),
      telefono: telefonoRaw.replace(/\s*\([^)]*\)\s*/g, '').trim(),
      empresa: extraer('Empresa'),
      titulo: extraer('T[ií]tulo'),
    };
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
      const buscarNormalizado = buscar.trim();
      for (const persona of array) {
        const qrValue = persona?.[campo];
        if (!qrValue) {
          continue;
        }

        try {
          const qrTexto = `${qrValue}`.replace(/&amp;/g, '&').trim();
          if (qrTexto === buscarNormalizado) {
            encontrado = true;
            registroId = persona.eventRegistrationId;
            if (persona['invitationStatus'] === 'Asistió a evento') {
              attendee = true;
            }
            break;
          }

          const match = qrTexto.match(/src="([^"]+)"/);
          if (!match?.[1]) {
            continue;
          }

          const params = new URLSearchParams(match[1].split('?')[1] ?? '');
          const codigoQr = params.get('data') ?? params.get('chl') ?? '';
          const id15 = (v: string) => `${v}`.trim().substring(0, 15);

          if (
            codigoQr &&
            (buscarNormalizado === codigoQr || id15(buscarNormalizado) === id15(codigoQr))
          ) {
            encontrado = true;
            registroId = persona.eventRegistrationId;
            if (persona['invitationStatus'] === 'Asistió a evento') {
              attendee = true;
            }
            break;
          }

          if (
            persona.eventRegistrationId &&
            id15(persona.eventRegistrationId) === id15(buscarNormalizado)
          ) {
            encontrado = true;
            registroId = persona.eventRegistrationId;
            if (persona['invitationStatus'] === 'Asistió a evento') {
              attendee = true;
            }
            break;
          }
        } catch {
          continue;
        }
      }
    }

    else{
      const esEmail = campo === 'email' || campo === 'emailEvento';
      const buscarNormalizado = esEmail
        ? buscar.toLocaleLowerCase().trim()
        : buscar.toLocaleLowerCase().trim().replace(/\./g, '');

      for (const persona of array) {
        const valorCampo = persona?.[campo];
        if (valorCampo == null || valorCampo === '') {
          continue;
        }

        const campoNormalizado = esEmail
          ? `${valorCampo}`.toLocaleLowerCase().trim()
          : `${valorCampo}`.toLocaleLowerCase().trim().replace(/\./g, '');

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
