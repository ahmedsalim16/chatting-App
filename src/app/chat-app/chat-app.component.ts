// chat-app.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/authservice.service';
import { ChatService, Message, Chat } from '../services/chatservice.service';
import { User } from 'firebase/auth';
import { Subscription } from 'rxjs';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.config';
import { StorageService } from '../services/storage.service';
interface ChatContact {
  id: string;
  name: string;
  avatar: string;
  status: string;
  isOnline: boolean;
  isActive?: boolean;
  chatId?: string;
  profileImage?: string;
  lastMessageTime?: any;
}

interface StatusOption {
  text: string;
  emoji: string;
  color: string;
}

@Component({
  selector: 'app-chat-app',
  templateUrl: './chat-app.component.html',
  styleUrls: ['./chat-app.component.css']
})
export class ChatAppComponent implements OnInit, OnDestroy {
  title = 'chat-app';
  
  // User data
  currentUser: User | null = null;
  user = {
    name: 'مستخدم جديد',
    status: '😊 متاح',
    profileImage: '',
    isOnline: true
  };

  // Chat data
  chatContacts: ChatContact[] = [];
  messages: Message[] = [];
  selectedContact: ChatContact | null = null;
  currentChatId: string = '';
  allUsers: any[] = [];

  // UI state
  statusOptions: StatusOption[] = [
    { text: 'متاح', emoji: '😊', color: 'green' },
    { text: 'مشغول', emoji: '🟡', color: 'yellow' },
    { text: 'غير متاح', emoji: '🔴', color: 'red' },
    { text: 'نائم', emoji: '😴', color: 'gray' }
  ];

  showProfileModal = false;
  isEditingStatus = false;
  tempStatus = '';
  messageText = '';
  sidebarOpen = false;
  
  // New UI states
  activeTab: 'chats' | 'users' = 'chats';
  searchTerm = '';
  filteredChats: ChatContact[] = [];
  filteredUsers: any[] = [];

  // Subscriptions
  private subscriptions: Subscription[] = [];

  constructor(
    private authService: AuthService,
    private chatService: ChatService,
    private router: Router,
    private storageService: StorageService
  ) {}

 ngOnInit(): void {
  console.log('ChatApp component initialized');
  
  const authSub = this.authService.getCurrentUser().subscribe(async user => {
    console.log('Auth state changed:', user?.email);
    this.currentUser = user;
    
    if (user) {
      // تحميل البيانات من Firestore الأول
      await this.loadUserData();
      
      // بعدين باقي البيانات
      this.loadChats();
      this.loadAllUsers();
    } else {
      console.log('No user logged in, redirecting to login');
      this.router.navigate(['/login']);
    }
  });
  
  this.subscriptions.push(authSub);
}

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  async manuallyAddCurrentUser(): Promise<void> {
  if (!this.currentUser) {
    alert('لا يوجد مستخدم مسجل');
    return;
  }
  
  try {
    console.log('Manually adding current user to Firestore...');
    
    const userRef = doc(db, 'users', this.currentUser.uid);
    const userData = {
      uid: this.currentUser.uid,
      email: this.currentUser.email || '',
      displayName: this.currentUser.displayName || 'مستخدم جديد',
      photoURL: this.currentUser.photoURL || '',
      isOnline: true,
      status: '😊 متاح',
      lastSeen: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(userRef, userData);
    console.log('User added successfully:', userData);
    alert('user added successfuly');
    
    // إعادة تحميل المستخدمين
    this.refreshUsersList();
    
  } catch (error) {
    console.error('Error manually adding user:', error);
    alert('خطأ: ' + (error instanceof Error ? error.message : String(error)));
  }
}

  // Tab Management
  setActiveTab(tab: 'chats' | 'users'): void {
    this.activeTab = tab;
    this.searchTerm = '';
    this.filterData();
  }

  // Search Functionality
  onSearchChange(): void {
    this.filterData();
  }
// في chat-app.component.ts أضف دالة refresh
async refreshUserProfile(): Promise<void> {
  if (this.currentUser) {
    await this.loadUserData();
    console.log('User profile refreshed');
  }
}

// ممكن تضيف زر refresh في HTML
// <button (click)="refreshUserProfile()">تحديث البيانات</button>
  private filterData(): void {
    const searchLower = this.searchTerm.toLowerCase();
    
    if (this.activeTab === 'chats') {
      this.filteredChats = this.chatContacts.filter(chat =>
        chat.name.toLowerCase().includes(searchLower) ||
        (chat.status && chat.status.toLowerCase().includes(searchLower))
      );
    } else {
      this.filteredUsers = this.allUsers.filter(user =>
        (user.displayName && user.displayName.toLowerCase().includes(searchLower)) ||
        (user.email && user.email.toLowerCase().includes(searchLower))
      );
    }
  }

  // User data methods
// تحديث دالة loadUserData في chat-app.component.ts
// في chat-app.component.ts
private async loadUserData(): Promise<void> {
  if (!this.currentUser) return;

  try {
    console.log('Loading user data from Firestore for:', this.currentUser.uid);
    
    // استنى البيانات من Firestore
    const profile = await this.authService.getUserProfile(this.currentUser.uid);
    
    if (profile) {
      console.log('Profile found in Firestore:', profile);
      
      // تحديث البيانات من Firestore (أهم من Firebase Auth)
      this.user.name = profile.displayName || this.currentUser.displayName || 'مستخدم جديد';
      this.user.status = profile.status || '😊 متاح';
      this.user.profileImage = profile.photoURL || this.currentUser.photoURL || '';
      this.user.isOnline = profile.isOnline || false;
      
      console.log('UI updated with Firestore data:', this.user);
    } else {
      console.log('No profile in Firestore, using Firebase Auth data');
      // إذا مفيش profile في Firestore، إنشاء واحد جديد
      await this.createUserProfileInFirestore();
    }
  } catch (error) {
    console.error('Error loading user data:', error);
    // في حالة الخطأ، استخدم بيانات Firebase Auth
    this.user.name = this.currentUser.displayName || 'مستخدم جديد';
    this.user.profileImage = this.currentUser.photoURL || '';
  }
}

// دالة إنشاء profile في Firestore لو مش موجود
private async createUserProfileInFirestore(): Promise<void> {
  if (!this.currentUser) return;
  
  try {
    const userRef = doc(db, 'users', this.currentUser.uid);
    const userData = {
      uid: this.currentUser.uid,
      email: this.currentUser.email || '',
      displayName: this.currentUser.displayName || 'مستخدم جديد',
      photoURL: this.currentUser.photoURL || '',
      isOnline: true,
      status: '😊 متاح',
      lastSeen: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await setDoc(userRef, userData);
    console.log('Created new user profile in Firestore');
    
    // تحديث UI
    this.user.name = userData.displayName;
    this.user.status = userData.status;
    this.user.profileImage = userData.photoURL;
  } catch (error) {
    console.error('Error creating user profile:', error);
  }
}

  // private loadAllUsers(): void {
  //   const usersSub = this.chatService.getAllUsers().subscribe(users => {
  //     this.allUsers = users.filter(u => u.uid !== this.currentUser?.uid);
  //     this.filterData(); // Update filtered users
  //   });
  //   this.subscriptions.push(usersSub);
  // }
   private loadAllUsers(): void {
  console.log('Loading all users...');
  const usersSub = this.chatService.getAllUsers().subscribe(users => {
    console.log('Users loaded from Firebase:', users);
    this.allUsers = users.filter(u => u.uid !== this.currentUser?.uid);
    console.log('Filtered users (excluding current user):', this.allUsers);
    this.filterData(); // Update filtered users
  });
  this.subscriptions.push(usersSub);
}

  // Chat methods
  private loadChats(): void {
    if (!this.currentUser) return;

    const chatsSub = this.chatService.getUserChats(this.currentUser.uid).subscribe(chats => {
      this.processChats(chats);
    });
    
    this.subscriptions.push(chatsSub);
  }

private async processChats(chats: Chat[]): Promise<void> {
  // مسح المحادثات القديمة
  this.chatContacts = [];
  
  for (const chat of chats) {
    const otherUserId = chat.participants.find(p => p !== this.currentUser?.uid);
    if (otherUserId) {
      // التأكد إن المحادثة مش مضافة قبل كده
      const existingContact = this.chatContacts.find(c => c.id === otherUserId);
      if (!existingContact) {
        const otherUserProfile = await this.authService.getUserProfile(otherUserId);
        if (otherUserProfile) {
          const contact: ChatContact = {
            id: otherUserId,
            name: otherUserProfile.displayName || 'مستخدم',
            avatar: otherUserProfile.displayName?.charAt(0).toUpperCase() || 'M',
            status: chat.lastMessage || 'لا توجد رسائل',
            isOnline: otherUserProfile.isOnline || false,
            chatId: chat.id,
            profileImage: otherUserProfile.photoURL,
            lastMessageTime: chat.lastMessageTime,
            isActive: false
          };
          
          this.chatContacts.push(contact);
        }
      }
    }
  }
  
  // ترتيب المحادثات حسب آخر رسالة
  this.chatContacts.sort((a, b) => {
    const timeA = a.lastMessageTime?.toMillis?.() || 0;
    const timeB = b.lastMessageTime?.toMillis?.() || 0;
    return timeB - timeA;
  });
  
  this.filterData(); // Update filtered chats
}

// دالة للتنظيف من المحادثات المكررة
private removeDuplicateContacts(): void {
  const uniqueContacts: ChatContact[] = [];
  const seenIds = new Set<string>();
  
  for (const contact of this.chatContacts) {
    if (!seenIds.has(contact.id)) {
      uniqueContacts.push(contact);
      seenIds.add(contact.id);
    }
  }
  
  this.chatContacts = uniqueContacts;
}
  // async startChatWithUser(user: any): Promise<void> {
  //   if (!this.currentUser) return;

  //   try {
  //     const chatId = await this.chatService.startChatWithUser(this.currentUser.uid, user.uid);
      
  //     // Check if contact already exists
  //     let existingContact = this.chatContacts.find(c => c.id === user.uid);
      
  //     if (!existingContact) {
  //       const newContact: ChatContact = {
  //         id: user.uid,
  //         name: user.displayName || 'مستخدم',
  //         avatar: user.displayName?.charAt(0).toUpperCase() || 'M',
  //         status: 'بدء محادثة جديدة',
  //         isOnline: user.isOnline || false,
  //         chatId: chatId,
  //         profileImage: user.photoURL,
  //         isActive: false
  //       };

  //       this.chatContacts.unshift(newContact);
  //       existingContact = newContact;
  //     }

  //     // Select the contact and switch to chats tab
  //     this.selectContact(existingContact);
  //     this.setActiveTab('chats');
      
  //   } catch (error) {
  //     console.error('Error starting chat:', error);
  //     alert('خطأ في بدء المحادثة');
  //   }
  // }

  // selectContact(contact: ChatContact): void {
  //   this.chatContacts.forEach(c => c.isActive = false);
  //   contact.isActive = true;
  //   this.selectedContact = contact;
  //   this.currentChatId = contact.chatId || '';
  //   this.sidebarOpen = false;
    
  //   if (this.currentChatId) {
  //     this.loadMessagesForChat(this.currentChatId);
  //   }
  // }

  // private loadMessagesForChat(chatId: string): void {
  //   // Clear existing message subscription
  //   const messagesSubs = this.subscriptions.filter(sub => sub.constructor.name === 'Subscription');
  //   messagesSubs.forEach(sub => {
  //     if (sub && !sub.closed) {
  //       sub.unsubscribe();
  //     }
  //   });

  //   const messagesSub = this.chatService.getMessages(chatId).subscribe(messages => {
  //     this.messages = messages.map(msg => ({
  //       ...msg,
  //       type: msg.senderId === this.currentUser?.uid ? 'sent' : 'received',
  //       author: msg.senderId === this.currentUser?.uid ? 'أنت' : msg.senderName
  //     }));

  //     // Scroll to bottom
  //     setTimeout(() => {
  //       const messagesContainer = document.querySelector('.chat-messages');
  //       if (messagesContainer) {
  //         messagesContainer.scrollTop = messagesContainer.scrollHeight;
  //       }
  //     }, 100);
  //   });

  //   this.subscriptions.push(messagesSub);
  // }

  async sendMessage(): Promise<void> {
    if (!this.messageText.trim() || !this.currentUser || !this.currentChatId) return;

    try {
      const message: Omit<Message, 'id' | 'timestamp'> = {
        text: this.messageText.trim(),
        senderId: this.currentUser.uid,
        senderName: this.currentUser.displayName || 'مستخدم',
        type: 'sent'
      };

      await this.chatService.sendMessage(this.currentChatId, message);
      this.messageText = '';
    } catch (error) {
      console.error('Error sending message:', error);
      alert('خطأ في إرسال الرسالة');
    }
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  // Time formatting methods
  formatTime(timestamp: any): string {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
      // Example formatting: return hours ago or date string
      if (diffInHours < 24) {
        return `${Math.floor(diffInHours)} ساعة مضت`;
      } else {
        return date.toLocaleDateString();
      }
    }


  
  showUsersList = false;

// في chat-app.component.ts
async saveStatus(): Promise<void> {
  if (this.tempStatus.trim() && this.currentUser) {
    try {
      console.log('Saving status:', this.tempStatus.trim());
      
      // حفظ في Firestore
      await this.authService.updateUserStatusText(this.currentUser.uid, this.tempStatus.trim());
      
      // تحديث الواجهة
      this.user.status = this.tempStatus.trim();
      this.cancelStatusEdit();
      
      console.log('Status saved successfully');
      alert('تم حفظ الحالة بنجاح');
      
    } catch (error) {
      console.error('Error updating status:', error);
      alert('خطأ في حفظ الحالة: ' + (error instanceof Error ? error.message : 'خطأ غير معروف'));
    }
  }
}

async setQuickStatus(status: StatusOption): Promise<void> {
  const newStatus = `${status.emoji} ${status.text}`;
  if (this.currentUser) {
    try {
      console.log('Setting quick status:', newStatus);
      
      await this.authService.updateUserStatusText(this.currentUser.uid, newStatus);
      this.user.status = newStatus;
      
      console.log('Quick status set successfully');
      
      
    } catch (error) {
      console.error('Error setting quick status:', error);
      alert('Error setting quick status');
    }
  }
}

  cancelStatusEdit(): void {
    this.isEditingStatus = false;
    this.tempStatus = '';
  }


  toggleUsersList(): void {
    this.showUsersList = !this.showUsersList;
  }

  // Profile methods
  openProfileModal(): void {
    this.showProfileModal = true;
  }

  closeProfileModal(): void {
    this.showProfileModal = false;
    this.cancelStatusEdit();
  }

  startEditingStatus(): void {
    this.isEditingStatus = true;
    this.tempStatus = this.user.status;
  }
async onImageUpload(event: any): Promise<void> {
  const file = event.target.files[0];
  if (!file) return;

  try {
    // التحقق من نوع الملف
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('يرجى اختيار صورة صحيحة (JPG, PNG, GIF, WebP)');
      return;
    }

    // التحقق من حجم الملف
    if (file.size > 2 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 2 ميجا');
      return;
    }

    if (!this.currentUser) {
      alert('يجب تسجيل الدخول أولاً');
      return;
    }

    // تحويل الصورة إلى Base64
    const reader = new FileReader();
    reader.onload = async (e: any) => {
      try {
        const imageData = e.target.result;
        
        // تحديث الواجهة فوراً
        this.user.profileImage = imageData;
        
        // حفظ في Firestore
        await this.authService.updateUserPhoto(this.currentUser!.uid, imageData);
        
        console.log('Image uploaded successfully');
        
      } catch (error) {
        console.error('Error uploading image:', error);
        alert('خطأ في حفظ الصورة: ' + (error instanceof Error ? error.message : 'خطأ غير معروف'));
        // إرجاع الصورة للحالة السابقة
        this.user.profileImage = this.currentUser?.photoURL || '';
      }
    };

    reader.onerror = () => {
      alert('خطأ في قراءة الملف');
    };

    reader.readAsDataURL(file);

  } catch (error) {
    console.error('Error processing image:', error);
    alert('خطأ في معالجة الصورة');
  }

  // مسح الـ input
  event.target.value = '';
}

  openFileDialog(): void {
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fileInput?.click();
  }
  
formatMessageTime(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date.getTime())) return '';
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'Pm' : 'Am';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 => 12
  return `${hours}:${minutes} ${ampm}`;
}

async startChatWithUser(user: any): Promise<void> {
  if (!this.currentUser) return;

  try {
    // أولاً، شوف لو الـ contact موجود فعلاً في المحادثات
    let existingContact = this.chatContacts.find(c => c.id === user.uid);
    
    if (existingContact) {
      // لو موجود، اختاره بس مش تضيفه تاني
      this.selectContact(existingContact);
      this.setActiveTab('chats');
      return;
    }

    // لو مش موجود، اعمل chat جديد
    const chatId = await this.chatService.startChatWithUser(this.currentUser.uid, user.uid);
    
    // إنشاء contact جديد
    const newContact: ChatContact = {
      id: user.uid,
      name: user.displayName || 'مستخدم',
      avatar: user.displayName?.charAt(0).toUpperCase() || 'M',
      status: 'بدء محادثة جديدة',
      isOnline: user.isOnline || false,
      chatId: chatId,
      profileImage: user.photoURL,
      lastMessageTime: null,
      isActive: false
    };

    // إضافة للقائمة
    this.chatContacts.unshift(newContact);
    
    // تحديث الفلتر
    this.filterData();
    
    // اختيار المحادثة الجديدة
    this.selectContact(newContact);
    this.setActiveTab('chats');
    
    console.log('New chat started with:', user.displayName);
    
  } catch (error) {
    console.error('Error starting chat:', error);
    alert('خطأ في بدء المحادثة');
  }
}

  selectContact(contact: ChatContact): void {
    this.chatContacts.forEach(c => c.isActive = false);
    contact.isActive = true;
    this.selectedContact = contact;
    this.currentChatId = contact.chatId || '';
    this.sidebarOpen = false;
    
    if (this.currentChatId) {
      this.loadMessagesForChat(this.currentChatId);
    }
  }

  private loadMessagesForChat(chatId: string): void {
    // إلغاء الاشتراك السابق في الرسائل
    const existingMessageSub = this.subscriptions.find(sub => sub.closed === false);
    if (existingMessageSub) {
      existingMessageSub.unsubscribe();
    }

    const messagesSub = this.chatService.getMessages(chatId).subscribe(messages => {
      this.messages = messages.map(msg => ({
        ...msg,
        type: msg.senderId === this.currentUser?.uid ? 'sent' : 'received',
        author: msg.senderId === this.currentUser?.uid ? 'أنت' : msg.senderName
      }));

      // Scroll to bottom
      setTimeout(() => {
        const messagesContainer = document.querySelector('.chat-messages');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 100);
    });

    this.subscriptions.push(messagesSub);
  }

  // Sign out
 // في chat-app.component.ts
async signOut(): Promise<void> {
  try {
    console.log('Signing out user...');
    
    if (this.currentUser) {
      // تحديث حالة المستخدم قبل الخروج
      await this.authService.updateUserStatus(this.currentUser.uid, false);
    }
    
    await this.authService.signOutUser();
    
    // مسح البيانات المحلية
    this.user = {
      name: 'مستخدم جديد',
      status: '😊 متاح',
      profileImage: '',
      isOnline: false
    };
    
    console.log('User signed out successfully');
    this.router.navigate(['/login']);
  } catch (error) {
    console.error('Error signing out:', error);
    // حتى لو في خطأ، اعمل logout
    this.router.navigate(['/login']);
  }
}
   // Utility method to refresh users list
  refreshUsersList(): void {
    this.loadAllUsers();
  }
 
  }
// (Remove this entire duplicate block. The previous declarations and methods already exist above.)