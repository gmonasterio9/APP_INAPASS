import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { BarcodeScanningModalComponent } from './barcode-scanning-modal.component';

describe('BarcodeScanningModalComponent', () => {
  let component: BarcodeScanningModalComponent;
  let fixture: ComponentFixture<BarcodeScanningModalComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ BarcodeScanningModalComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(BarcodeScanningModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
