import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegistroManualPage } from './registro-manual.page';

describe('RegistroManualPage', () => {
  let component: RegistroManualPage;
  let fixture: ComponentFixture<RegistroManualPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(RegistroManualPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
