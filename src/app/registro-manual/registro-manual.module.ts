import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { RegistroManualPageRoutingModule } from './registro-manual-routing.module';

import { RegistroManualPage } from './registro-manual.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    RegistroManualPageRoutingModule
  ],
  declarations: [RegistroManualPage]
})
export class RegistroManualPageModule {}
