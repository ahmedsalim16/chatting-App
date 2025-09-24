import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/authservice.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
 // Login form data
  loginEmail = '';
  loginPassword = '';
  
  // Signup form data
  signupName = '';
  signupEmail = '';
  signupPassword = '';
  
  // Loading states
  isLoginLoading = false;
  isSignupLoading = false;
  
  // Error messages
  loginError = '';
  signupError = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}
 showLoginPassword = false;
  showSignupPassword = false;

  // ... باقي الكود الموجود

  // Toggle password visibility functions
  toggleLoginPassword(): void {
    this.showLoginPassword = !this.showLoginPassword;
  }

  toggleSignupPassword(): void {
    this.showSignupPassword = !this.showSignupPassword;
  }
  // تسجيل الدخول بالإيميل والباسوورد
  async onLogin(): Promise<void> {
    if (!this.loginEmail.trim() || !this.loginPassword.trim()) {
      this.loginError = 'يرجى إدخال البريد الإلكتروني وكلمة المرور';
      return;
    }

    this.isLoginLoading = true;
    this.loginError = '';

    try {
      await this.authService.signInWithEmail(this.loginEmail, this.loginPassword);
      this.router.navigate(['/Home']);
    } catch (error: any) {
      console.error('Login error:', error);
      
      // معالجة أنواع الأخطاء المختلفة
      switch (error.code) {
        case 'auth/user-not-found':
          this.loginError = 'المستخدم غير موجود';
          break;
        case 'auth/wrong-password':
          this.loginError = 'كلمة المرور غير صحيحة';
          break;
        case 'auth/invalid-email':
          this.loginError = 'البريد الإلكتروني غير صحيح';
          break;
        case 'auth/too-many-requests':
          this.loginError = 'تم تجاوز عدد المحاولات المسموح';
          break;
        default:
          this.loginError = 'خطأ في تسجيل الدخول';
      }
    } finally {
      this.isLoginLoading = false;
    }
  }

  // تسجيل مستخدم جديد
  async onSignup(): Promise<void> {
    if (!this.signupName.trim() || !this.signupEmail.trim() || !this.signupPassword.trim()) {
      this.signupError = 'يرجى إدخال جميع البيانات';
      return;
    }

    if (this.signupPassword.length < 6) {
      this.signupError = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
      return;
    }

    this.isSignupLoading = true;
    this.signupError = '';

    try {
      await this.authService.signUpWithEmail(
        this.signupEmail, 
        this.signupPassword, 
        this.signupName
      );
      this.router.navigate(['/Home']);
    } catch (error: any) {
      console.error('Signup error:', error);
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          this.signupError = 'البريد الإلكتروني مستخدم بالفعل';
          break;
        case 'auth/invalid-email':
          this.signupError = 'البريد الإلكتروني غير صحيح';
          break;
        case 'auth/weak-password':
          this.signupError = 'كلمة المرور ضعيفة';
          break;
        default:
          this.signupError = 'خطأ في التسجيل';
      }
    } finally {
      this.isSignupLoading = false;
    }
  }

  // تسجيل الدخول بـ Google
  async signInWithGoogle(): Promise<void> {
    try {
      await this.authService.signInWithGoogle();
      this.router.navigate(['/Home']);
    } catch (error) {
      console.error('Google sign-in error:', error);
      this.loginError = 'خطأ في تسجيل الدخول بـ Google';
    }
  }

  // مسح رسائل الخطأ
  clearErrors(): void {
    this.loginError = '';
    this.signupError = '';
  }
}
