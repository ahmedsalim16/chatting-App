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
async signInWithEmail(email: string, password: string): Promise<User> {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    
    // تأكد من حفظ المستخدم في Firestore في كل login
    await this.forceCreateUserProfile(result.user);
    
    return result.user;
  } catch (error) {
    console.error('Error signing in with email:', error);
    throw error;
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

async signInWithGoogle(): Promise<User> {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    
    // حفظ مباشر في Firestore
    await this.forceCreateUserProfile(result.user);
    
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
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
    console.log('User exists in Firestore:', userExists);

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

    console.log('Saving user data:', userData);
    await setDoc(userRef, userData, { merge: true });
    console.log('User data saved successfully');
    
    if (!userExists) {
      console.log('New user created in Firestore:', userData.displayName);
      await this.addWelcomeNotification(user.uid);
    }
    
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
  async updateUserStatusText(userId: string, status: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, { 
        status,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Error updating user status text:', error);
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
    } catch (error) {
      console.error('Error updating user photo:', error);
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
}