import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { EventosService } from '../services/eventos.service';
import { NavController } from '@ionic/angular';
import { UtilsService } from '../services/utils.service';
import { DialogService } from '../services/dialog.service';
import { Preferences } from '@capacitor/preferences';
import { AuthService } from '../services/auth.service';
@Component({
  selector: 'app-eventos',
  templateUrl: './eventos.page.html',
  styleUrls: ['./eventos.page.scss'],
  standalone: false,
})
export class EventosPage implements OnInit {

  // events: any[] = [];

  // constructor(private router: Router,
  //             private eventos : EventosService,
  //             private nav: NavController,
  //             private utils: UtilsService,
  //             private dialog: DialogService,
  //             private auth: AuthService) { }
  
  // mostrarEvento(param: any){
  //   this.nav.navigateForward(['/registrar-asistencia'], {state: param});
  // }
  // async tapLogout(){
  //   await this.auth.clearAuth();
  //   this.router.navigate(['/home'], { queryParams: { logout: true } })
  // }

  // async ionViewWillEnter() {
  //   try {
  //     const loading = await this.dialog.showLoading({ message: 'Cargando...' });
  //     const response = await this.eventos.getEventos();
  //     if (response.success) {
  //       const hoy = new Date();
  
  //       this.events = response.data.eventos.listadoEventos
  //         .map((evento: any) => {
  //           return {
  //             ...evento,
  //             fechaStart: this.utils.convertirFecha(evento.eventStartDate),
  //             fechaEnd: this.utils.convertirFecha(evento.eventEndtDate)
  //           };
  //         })
  //         .filter((evento: any) => evento.fechaEnd >= hoy)
  //         .sort((a: any, b: any) => a.fechaStart.getTime() - b.fechaStart.getTime());
  //     }
  //   } catch (error) {
  //     console.error('Error al cargar eventos:', error);
  //   } finally {
  //     await this.dialog.dismissLoading();
  //   }
  // }
  
  ngOnInit() {
    
  }

  // estado(inicio: Date, fin: Date){
  //   return this.utils.resolverEstado(inicio, fin);
  // }
  
}

