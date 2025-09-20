// services/storage.service.ts
import { Injectable } from '@angular/core';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase.config';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  constructor() { }

  // رفع صورة المستخدم
  async uploadUserProfileImage(userId: string, file: File): Promise<string> {
    try {
      console.log('Uploading profile image for user:', userId);
      
      // إنشاء مرجع للملف
      const imageRef = ref(storage, `profile-images/${userId}/${Date.now()}_${file.name}`);
      
      // رفع الملف
      const snapshot = await uploadBytes(imageRef, file);
      console.log('Upload successful:', snapshot);
      
      // الحصول على رابط التحميل
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('Download URL:', downloadURL);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  // حذف صورة قديمة
  async deleteUserProfileImage(imageUrl: string): Promise<void> {
    try {
      if (imageUrl && imageUrl.includes('firebasestorage.googleapis.com')) {
        const imageRef = ref(storage, imageUrl);
        await deleteObject(imageRef);
        console.log('Old image deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting old image:', error);
      // لا نرمي خطأ هنا لأن حذف الصورة القديمة ليس أساسي
    }
  }

  // التحقق من نوع الملف
  isValidImageFile(file: File): boolean {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    return allowedTypes.includes(file.type);
  }

  // التحقق من حجم الملف (بالميجابايت)
  isValidFileSize(file: File, maxSizeMB: number = 5): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.size <= maxSizeBytes;
  }
}