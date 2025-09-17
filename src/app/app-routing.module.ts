import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { ForgetPasswordComponent } from './forget-password/forget-password.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { ChatAppComponent } from './chat-app/chat-app.component';

const routes: Routes = [
  { path: '', redirectTo:'/login',pathMatch:'full' },
  { path: 'login', component:LoginComponent },
  { path: 'forget-password', component:ForgetPasswordComponent },
  { path: 'reset-password', component:ResetPasswordComponent },
  { path: 'Home', component:ChatAppComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
