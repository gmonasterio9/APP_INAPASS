import { AfterViewInit, ElementRef, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } from '@capacitor/barcode-scanner';
import { DialogService } from '../../services/dialog.service';




@Component({
  selector: 'app-barcode-scanning-modal',
  templateUrl: './barcode-scanning-modal.component.html',
  styleUrls: ['./barcode-scanning-modal.component.scss'],
  standalone: false,
})
export class BarcodeScanningModalComponent  implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('square')
  public squareElement: ElementRef<HTMLDivElement> | undefined;

  public isTorchAvailable = false;
  public minZoomRatio: number | undefined;
  public maxZoomRatio: number | undefined;

  constructor(private readonly dialogService: DialogService,
  ) { }

  ngOnInit():void {}

  public ngAfterViewInit(): void {
    setTimeout(() => {
      this.startScan();
    }, 500);
  }
  public ngOnDestroy(): void {
    this.stopScan();
  }

  public async closeModal(barcode?: string): Promise<void> {
    this.dialogService.dismissModal({
      barcode: barcode,
    });
  }

  private async startScan() {
    document.querySelector('body')?.classList.add('barcode-scanning-active');

    try {
      const result = await CapacitorBarcodeScanner.scanBarcode({
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
      });

      if (result?.ScanResult) {
        this.closeModal(result.ScanResult);
      } else {
        this.closeModal(undefined);
      }
    } catch {
      this.closeModal(undefined);
    } finally {
      document.querySelector('body')?.classList.remove('barcode-scanning-active');
    }
  }

  private async stopScan(): Promise<void> {
    document.querySelector('body')?.classList.remove('barcode-scanning-active');
  }

}
