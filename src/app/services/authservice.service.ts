// auth.service.ts
import { Injectable } from '@angular/core';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc, collection, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase.config';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    // مراقبة حالة المصادقة
    onAuthStateChanged(auth, (user) => {
      this.currentUserSubject.next(user);
      if (user) {
        this.updateUserStatus(user.uid, true);
        // تحديث آخر ظهور للمستخدم
        this.updateLastSeen(user.uid);
      }
    });
  }

  // تسجيل دخول بـ Google
 // في authservice.service.ts - استبدال الدالة دي
// في authservice.service.ts
async signInWithEmail(email: string, password: string): Promise<User> {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    
    // تحديث حالة الاتصال والتأكد من حفظ البيانات
    await this.ensureUserProfileExists(result.user);
    
    return result.user;
  } catch (error) {
    console.error('Error signing in with email:', error);
    throw error;
  }
}

// في authservice.service.ts
async signInWithGoogle(): Promise<User> {
  try {
    console.log('Attempting Google sign-in...');
    
    const provider = new GoogleAuthProvider();
    
    // إضافة scopes مطلوبة
    provider.addScope('profile');
    provider.addScope('email');
    
    // إعدادات إضافية
    provider.setCustomParameters({
      prompt: 'select_account' // يخلي المستخدم يختار الأكونت
    });

    const result = await signInWithPopup(auth, provider);
    console.log('Google sign-in successful:', result.user.email);
    
    // إنشاء أو تحديث profile
    await this.ensureUserProfileExists(result.user);
    
    return result.user;
    
  } catch (error: any) {
    console.error('Google sign-in error details:', error);
    
    // معالجة أخطاء Google المختلفة
    let errorMessage = 'خطأ في تسجيل الدخول بـ Google';
    
    switch (error.code) {
      case 'auth/popup-closed-by-user':
        errorMessage = 'تم إغلاق نافذة تسجيل الدخول';
        break;
      case 'auth/popup-blocked':
        errorMessage = 'المتصفح منع النافذة المنبثقة. يرجى السماح للنوافذ المنبثقة وإعادة المحاولة';
        break;
      case 'auth/cancelled-popup-request':
        errorMessage = 'تم إلغاء طلب تسجيل الدخول';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'خطأ في الشبكة. تأكد من الاتصال بالإنترنت';
        break;
      case 'auth/internal-error':
        errorMessage = 'خطأ داخلي. جرب مرة أخرى';
        break;
      case 'auth/invalid-api-key':
        errorMessage = 'خطأ في إعدادات Firebase';
        break;
      case 'auth/app-not-authorized':
        errorMessage = 'التطبيق غير مصرح له باستخدام Google Sign-in';
        break;
      default:
        errorMessage = `خطأ: ${error.message}`;
    }
    
    throw new Error(errorMessage);
  }
}

// دالة للتأكد من وجود profile في Firestore
private async ensureUserProfileExists(user: User): Promise<void> {
  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      // المستخدم موجود، تحديث حالة الاتصال فقط
      await setDoc(userRef, {
        isOnline: true,
        lastSeen: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      console.log('Updated existing user status');
    } else {
      // المستخدم جديد، إنشاء profile كامل
      const userData = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'مستخدم جديد',
        photoURL: user.photoURL || '',
        isOnline: true,
        status: '😊 متاح',
        lastSeen: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await setDoc(userRef, userData);
      console.log('Created new user profile');
    }
  } catch (error) {
    console.error('Error ensuring user profile exists:', error);
  }
}

async signUpWithEmail(email: string, password: string, displayName: string): Promise<User> {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    
    await updateProfile(result.user, { displayName });
    
    // حفظ مباشر في Firestore
    await this.forceCreateUserProfile(result.user, displayName);
    
    return result.user;
  } catch (error) {
    console.error('Error signing up:', error);
    throw error;
  }
}



// دالة جديدة للحفظ الإجباري
private async forceCreateUserProfile(user: User, customDisplayName?: string): Promise<void> {
  try {
    console.log('Force creating user profile for:', user.email);
    
    const userRef = doc(db, 'users', user.uid);
    const userData = {
      uid: user.uid,
      email: user.email || '',
      displayName: customDisplayName || user.displayName || 'مستخدم جديد',
      photoURL: user.photoURL || '',
      isOnline: true,
      status: '😊 متاح',
      lastSeen: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    console.log('Saving user data to Firestore:', userData);
    
    // حفظ مباشر بدون merge
    await setDoc(userRef, userData);
    
    console.log('User profile created successfully in Firestore');
    
  } catch (error) {
    console.error('Error force creating user profile:', error);
    alert('خطأ في حفظ بيانات المستخدم: ' + (error instanceof Error ? error.message : String(error)));
  }
}

  // إنشاء أو تحديث بروفايل المستخدم
// في authservice.service.ts تأكد إن البيانات بتتحفظ صحيح
private async createOrUpdateUserProfile(
  user: User, 
  isExistingUser: boolean = false, 
  customDisplayName?: string
): Promise<void> {
  try {
    console.log('Creating/updating user profile for:', user.email);
    const userRef = doc(db, 'users', user.uid);
    
    const userSnap = await getDoc(userRef);
    const userExists = userSnap.exists();
    
    const userData = {
      uid: user.uid,
      email: user.email,
      displayName: customDisplayName || user.displayName || 'مستخدم جديد',
      photoURL: user.photoURL || null,
      lastSeen: serverTimestamp(),
      isOnline: true,
      status: userExists ? userSnap.data()?.['status'] || '😊 متاح' : '😊 متاح',
      createdAt: userExists ? userSnap.data()?.['createdAt'] : serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    console.log('Saving user data to Firestore:', userData);
    await setDoc(userRef, userData, { merge: true });
    console.log('User profile saved successfully');
    
  } catch (error) {
    console.error('Error creating/updating user profile:', error);
    throw error;
  }
}

  // إضافة إشعار ترحيب للمستخدمين الجدد
  private async addWelcomeNotification(userId: string): Promise<void> {
    try {
      const notificationsRef = collection(db, `users/${userId}/notifications`);
      await addDoc(notificationsRef, {
        title: 'مرحباً بك!',
        message: 'أهلاً وسهلاً بك في تطبيق الشات. يمكنك الآن بدء المحادثات مع الآخرين.',
        type: 'welcome',
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error adding welcome notification:', error);
      // لا نرمي خطأ هنا لأن هذا ليس أساسي
    }
  }

  // تحديث حالة المستخدم (اونلاين/أوفلاين)
  async updateUserStatus(userId: string, isOnline: boolean): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, {
        isOnline,
        lastSeen: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  }

  // تحديث آخر ظهور
  async updateLastSeen(userId: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, {
        lastSeen: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Error updating last seen:', error);
    }
  }

  // تحديث حالة المستخدم (النص)
  // في authservice.service.ts تأكد من وجود هذه الدالة
async updateUserStatusText(userId: string, status: string): Promise<void> {
  try {
    console.log('Updating user status in Firestore:', userId, status);
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, { 
      status,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log('User status updated successfully in Firestore');
  } catch (error) {
    console.error('Error updating user status text:', error);
    throw error;
  }
}

  // تحديث صورة المستخدم
 async updateUserPhoto(userId: string, photoURL: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, { 
      photoURL,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log('Profile photo updated successfully');
  } catch (error) {
    console.error('Error updating user photo:', error);
    throw error;
  }
}

  // تسجيل خروج
  async signOutUser(): Promise<void> {
    try {
      const user = auth.currentUser;
      if (user) {
        await this.updateUserStatus(user.uid, false);
      }
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  // الحصول على المستخدم الحالي
  getCurrentUser(): Observable<User | null> {
    return this.currentUser$;
  }

  // الحصول على معلومات المستخدم من Firestore
  async getUserProfile(userId: string): Promise<any> {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      return userSnap.exists() ? userSnap.data() : null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  // التحقق من وجود مستخدم في النظام
  async checkUserExists(userId: string): Promise<boolean> {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      return userSnap.exists();
    } catch (error) {
      console.error('Error checking user existence:', error);
      return false;
    }
  }
  // في authservice.service.ts - أضف هذه الدالة
async updateUserProfileImage(userId: string, photoURL: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, { 
      photoURL,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log('Profile image URL updated in Firestore');
  } catch (error) {
    console.error('Error updating profile image in Firestore:', error);
    throw error;
  }
}

}