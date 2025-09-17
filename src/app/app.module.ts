import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './login/login.component';
import { ForgetPasswordComponent } from './forget-password/forget-password.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { ChatAppComponent } from './chat-app/chat-app.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
// import { AngularFireModule } from '@angular/fire/compat';
// import { AngularFireAuthModule } from '@angular/fire/compat/auth';
// import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { firebaseConfig } from '../environment';
@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    ForgetPasswordComponent,
    ResetPasswordComponent,
    ChatAppComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
     CommonModule,
    FormsModule,
    
    // AngularFireModule.initializeApp(firebaseConfig),
    // AngularFireAuthModule,
    // AngularFirestoreModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})

export class AppModule { }
