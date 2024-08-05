import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { TrasferPageRoutingModule } from './trasfer-routing.module';
import { TrasferPage } from './trasfer.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TrasferPageRoutingModule
  ],
  declarations: [TrasferPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]  // Añadir esta línea
})
export class TrasferPageModule {}
