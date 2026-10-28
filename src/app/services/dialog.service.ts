import { Injectable } from '@angular/core';
import { ActionSheetOptions, AlertOptions, LoadingOptions} from '@ionic/core';
import { ActionSheetController, AlertController, ModalOptions, ModalController, LoadingController} from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class DialogService {

  constructor(
    private alertCtrl: AlertController,
    private actionSheetCtrl: ActionSheetController,
    private modalCtrl: ModalController,
    private loadingCtrl: LoadingController,
  ) { }

  public async showActionSheet(opts?: ActionSheetOptions): Promise<HTMLIonActionSheetElement> {
    const actionSheet = await this.actionSheetCtrl.create(opts);
    await actionSheet.present();
    return actionSheet;
  }

  public async confirmarSalidaSesion(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.showActionSheet({
        header: '¿Cerrar sesión?',
        subHeader: 'Se cerrará tu sesión actual',
        cssClass: 'action-sheet-logout',
        buttons: [
          {
            text: 'Cerrar sesión',
            icon: 'log-out-outline',
            role: 'destructive',
            handler: () => resolve(true),
          },
          {
            text: 'Cancelar',
            icon: 'close',
            role: 'cancel',
            cssClass: 'action-sheet-cancel-logout',
            handler: () => resolve(false),
          },
        ],
      });
    });
  }

  public async showAlert(opts?: AlertOptions): Promise<HTMLIonAlertElement> {
    const alert = await this.alertCtrl.create({
      ...opts,
      mode: 'ios',
    });
    await alert.present();
    return alert;
  }
  public async showAlertConCierreYLoader(opts: AlertOptions) {
    const nuevosBotones = (opts.buttons || []).map(button => {
      if (typeof button === 'string') return button;
  
      const originalHandler = button.handler;
  
      return {
        ...button,
        handler: async () => {
          const alert = await this.alertCtrl.getTop();
          if (alert) await alert.dismiss(undefined, 'dismiss');
  
          const loading = await this.showLoading({ message: 'Procesando...' });
  
          try {
            if (typeof originalHandler === 'function') {
              await Promise.resolve(originalHandler(undefined));
            }
          } catch (err) {
            console.error('Error en acción del alert:', err);
          } finally {
            await this.dismissLoading();
          }
        }
      };
    });
  
    const alert = await this.alertCtrl.create({
      ...opts,
      buttons: nuevosBotones,
      mode: 'ios',
    });
  
    await alert.present();
  
    setTimeout(() => {
      const msg = document.querySelector('ion-alert .alert-message');
      if (msg) (msg as HTMLElement).style.whiteSpace = 'pre-line';
    }, 100);
  
    return alert;
  }
  public async showModal(opts: ModalOptions): Promise<HTMLIonModalElement> {
    const modal = await this.modalCtrl.create(opts);
    await modal.present();
    return modal;
  }
  public async dismissModal(data?: any): Promise<boolean> {
    return this.modalCtrl.dismiss(data);
  }
  public async showLoading(opts?: LoadingOptions): Promise<HTMLIonLoadingElement> {
    const defaultOpts: LoadingOptions = {
      message: 'Cargando...',
    };
    opts = { ...defaultOpts, ...opts };
    const loading = await this.loadingCtrl.create({
      ...opts,
      mode: 'ios',
    });
    await loading.present();
    return loading;
  }
  public async dismissLoading(data?: any): Promise<boolean> {
    try {
      const top = await this.loadingCtrl.getTop();
      if (!top) {
        return false;
      }
      return await this.loadingCtrl.dismiss(data);
    } catch {
      return false;
    }
  }
}
