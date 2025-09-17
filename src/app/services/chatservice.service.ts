// chat.service.ts
import { Injectable } from '@angular/core';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot,
  where,
  serverTimestamp,
  doc,
  getDocs,
  updateDoc,
  setDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase.config';
import { Observable, BehaviorSubject } from 'rxjs';

export interface Message {
  id?: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: Timestamp | any;
  type?: 'sent' | 'received';
  author?: string;
}

export interface Chat {
  id?: string;
  participants: string[];
  createdAt: Timestamp | any;
  lastMessage?: string;
  lastMessageTime?: Timestamp | any;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private messagesSubject = new BehaviorSubject<Message[]>([]);
  public messages$ = this.messagesSubject.asObservable();

  constructor() {}

  // إرسال رسالة
  async sendMessage(chatId: string, message: Omit<Message, 'id' | 'timestamp'>): Promise<void> {
    try {
      const messagesRef = collection(db, `chats/${chatId}/messages`);
      const messageData = {
        ...message,
        timestamp: serverTimestamp()
      };
      
      await addDoc(messagesRef, messageData);
      
      // تحديث آخر رسالة في المحادثة
      await this.updateLastMessage(chatId, message.text);
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // الاستماع للرسائل في الوقت الفعلي
  getMessages(chatId: string): Observable<Message[]> {
    return new Observable(observer => {
      try {
        const messagesRef = collection(db, `chats/${chatId}/messages`);
        const q = query(messagesRef, orderBy('timestamp', 'asc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const messages: Message[] = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          } as Message));
          
          observer.next(messages);
          this.messagesSubject.next(messages);
        }, (error) => {
          console.error('Error listening to messages:', error);
          observer.error(error);
        });

        // إرجاع دالة unsubscribe للتنظيف
        return unsubscribe;
      } catch (error) {
        console.error('Error setting up messages listener:', error);
        observer.error(error);
        return () => {}; // Return empty cleanup function
      }
    });
  }

  // إنشاء محادثة جديدة
  async createChat(participants: string[]): Promise<string> {
    try {
      // التحقق إذا كانت المحادثة موجودة مسبقاً
      const existingChat = await this.findExistingChat(participants);
      if (existingChat) {
        return existingChat.id!;
      }

      const chatsRef = collection(db, 'chats');
      const chatData: Omit<Chat, 'id'> = {
        participants: participants.sort(), // Sort for consistent comparison
        createdAt: serverTimestamp(),
        lastMessage: '',
        lastMessageTime: serverTimestamp()
      };
      
      const docRef = await addDoc(chatsRef, chatData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating chat:', error);
      throw error;
    }
  }

  // البحث عن محادثة موجودة
  private async findExistingChat(participants: string[]): Promise<Chat | null> {
    try {
      const sortedParticipants = participants.sort();
      const chatsRef = collection(db, 'chats');
      
      // Get all chats and filter locally since Firestore array queries are limited
      const snapshot = await getDocs(chatsRef);
      
      for (const docSnap of snapshot.docs) {
        const chatData = docSnap.data() as Chat;
        if (chatData.participants && 
            chatData.participants.length === sortedParticipants.length &&
            chatData.participants.sort().every((p, i) => p === sortedParticipants[i])) {
          return { id: docSnap.id, ...chatData };
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding existing chat:', error);
      return null;
    }
  }

  // الحصول على محادثات المستخدم
  getUserChats(userId: string): Observable<Chat[]> {
    return new Observable(observer => {
      try {
        const chatsRef = collection(db, 'chats');
        const q = query(
          chatsRef, 
          where('participants', 'array-contains', userId)
        );
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const chats: Chat[] = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          } as Chat));
          
          // Sort by last message time (most recent first)
          chats.sort((a, b) => {
            const aTime = a.lastMessageTime?.toMillis?.() || 0;
            const bTime = b.lastMessageTime?.toMillis?.() || 0;
            return bTime - aTime;
          });
          
          observer.next(chats);
        }, (error) => {
          console.error('Error listening to chats:', error);
          observer.error(error);
        });

        return unsubscribe;
      } catch (error) {
        console.error('Error setting up chats listener:', error);
        observer.error(error);
        return () => {};
      }
    });
  }

  // تحديث آخر رسالة في المحادثة
  private async updateLastMessage(chatId: string, lastMessage: string): Promise<void> {
    try {
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        lastMessage,
        lastMessageTime: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating last message:', error);
      // Don't throw error here as message was sent successfully
    }
  }

  // الحصول على جميع المستخدمين (للبحث عن جهات اتصال)
  getAllUsers(): Observable<any[]> {
    return new Observable(observer => {
      try {
        const usersRef = collection(db, 'users');
        // ترتيب حسب آخر تحديث لإظهار المستخدمين الجدد أولاً
        const q = query(usersRef, orderBy('updatedAt', 'desc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const users = snapshot.docs.map(docSnap => {
            const userData = docSnap.data();
            return {
              id: docSnap.id,
              displayName: userData['displayName'],
              email: userData['email'],
              uid: userData['uid'],
              // تحويل Timestamps إلى تواريخ قابلة للقراءة
              createdAt: userData['createdAt'],
              updatedAt: userData['updatedAt'],
              lastSeen: userData['lastSeen']
            };
          });
          
          // فلترة المستخدمين - إظهار المستخدمين النشطين فقط
          const activeUsers = users.filter(user => 
            user.displayName && // له اسم
            user.email && // له إيميل
            user.uid // له معرف
          );
          
          console.log('Loaded users:', activeUsers.length);
          observer.next(activeUsers);
        }, (error) => {
          console.error('Error listening to users:', error);
          observer.error(error);
        });

        return unsubscribe;
      } catch (error) {
        console.error('Error setting up users listener:', error);
        observer.error(error);
        return () => {};
      }
    });
  }

  // إنشاء محادثة مع مستخدم محدد
  async startChatWithUser(currentUserId: string, targetUserId: string): Promise<string> {
    const participants = [currentUserId, targetUserId].sort();
    return await this.createChat(participants);
  }
}