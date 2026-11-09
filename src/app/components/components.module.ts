import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { IonicModule } from "@ionic/angular";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { BarcodeScanningModalComponent } from "./barcode-scanning-modal/barcode-scanning-modal.component";
import { DatosExistentesModalComponent } from "./datos-existentes-modal/datos-existentes-modal.component";

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule
  ],
  declarations: [
    BarcodeScanningModalComponent,
    DatosExistentesModalComponent
  ],
  exports: [
    BarcodeScanningModalComponent, 
    DatosExistentesModalComponent
  ]
})
export class ComponentsModule { }