import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { RegistroManualPage } from './registro-manual.page';

const routes: Routes = [
  {
    path: '',
    component: RegistroManualPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RegistroManualPageRoutingModule {}
