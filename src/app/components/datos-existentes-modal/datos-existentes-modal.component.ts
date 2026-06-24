import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonContent } from '@ionic/angular';
import { DialogService } from 'src/app/services/dialog.service';
import { RegistroAsistenciaService } from 'src/app/services/registro-asistencia.service';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';

@Component({
  selector: 'app-datos-existentes-modal',
  templateUrl: './datos-existentes-modal.component.html',
  styleUrls: ['./datos-existentes-modal.component.scss'],
  standalone: false,

})
export class DatosExistentesModalComponent  implements OnInit {
  
  @Input() participanteBody!: any;
  @Input() nombreContacto!: string;
  @Input() apellidoContacto!: string;
  @Input() rutContacto!: string;
  @Input() correoContacto!: string;
  @Input() evento!: string;
  @ViewChild(IonContent, { static: false }) content: IonContent | undefined;


  form!: FormGroup;
  submitted = false;
  originalValues: any;
  
  constructor(private readonly dialogService: DialogService,
    private fb: FormBuilder,
    private asistencia: RegistroAsistenciaService,
    private dialog: DialogService) { }

  ngOnInit() {
    Keyboard.addListener('keyboardWillShow', info => {
      const form = document.querySelector('.contenedor-form') as HTMLElement;
      if (form) {
        form.style.transform = `translateY(-${info.keyboardHeight * 0.6}px)`;
      }
    });
  
    Keyboard.addListener('keyboardWillHide', () => {
      const form = document.querySelector('.contenedor-form') as HTMLElement;
      if (form) {
        form.style.transform = 'translateY(0)';
      }
    });
    const nombreCompleto = `${this.nombreContacto || ''} ${this.apellidoContacto || ''}`;
    this.form = this.fb.group({
      nombre: [nombreCompleto|| '', Validators.required],
      rut: [this.rutContacto || '', Validators.required],
      correo: [this.correoContacto || '', Validators.compose([Validators.required, Validators.email])]
    });
    this.originalValues = this.form.getRawValue();
  }

  async registrar() {
    this.submitted = true;
    try{
      if (this.form.valid) {
        await this.dialog.showLoading({ message: 'Registrando...' });
        const originalCorreo = this.originalValues.correo;
        const nuevoCorreo = this.correoControl?.value;
        const correoChanged = originalCorreo !== nuevoCorreo;

        if (correoChanged){
          let bodyContacto = "";
          if(this.participanteBody.EsLead){
            bodyContacto = this.asistencia.crearBodyCorreoLead(this.correoControl?.value)
          }
          else{
            bodyContacto = this.asistencia.crearBodyCorreoContacto(this.correoControl?.value)
          }
          await this.asistencia.actualizarYregistrar(bodyContacto, this.participanteBody.IdRegistro, this.evento, this.participanteBody.EsLead)
        }
        else{
          await this.asistencia.registrarParticipante(this.participanteBody, this.evento)
        }
      this.closeModal()  
      }
    }
    catch (error) {
      console.error('Error en el registro:', error);
      await this.dialog.showAlert({
        header: 'Error',
        message: 'Hubo un problema al registrar. Intenta nuevamente.',
        buttons: ['Aceptar']
      });
    } finally {
      await this.dialog.dismissLoading(); 
    }
  }

  get nombreControl() {
    return this.form.get('nombre');
  }

  get rutControl() {
    return this.form.get('rut');
  }

  get correoControl() {
    return this.form.get('correo');
  }

  enfocarCampo(input: any) {
    setTimeout(() => {
      input.setFocus();
    }, 100);
  }
  
  public async closeModal(): Promise<void> {
    this.dialogService.dismissModal({
    });
  }

}
