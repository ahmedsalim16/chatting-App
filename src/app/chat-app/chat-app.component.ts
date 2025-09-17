// chat-app.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/authservice.service';
import { ChatService, Message, Chat } from '../services/chatservice.service';
import { User } from 'firebase/auth';
import { Subscription } from 'rxjs';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.config';

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
    private router: Router
  ) {}

  ngOnInit(): void {
    // التحقق من وجود مستخدم مسجل
    const authSub = this.authService.getCurrentUser().subscribe(user => {
      this.currentUser = user;
      
      if (user) {
        this.user.name = user.displayName || 'مستخدم جديد';
        this.user.profileImage = user.photoURL || '';
        this.loadUserData();
        this.loadChats();
        this.loadAllUsers();
      } else {
        // إذا لم يكن هناك مستخدم، إعادة توجيه للصفحة الرئيسية
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
    alert('تم إضافة المستخدم بنجاح');
    
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
  private async loadUserData(): Promise<void> {
    if (this.currentUser) {
      const profile = await this.authService.getUserProfile(this.currentUser.uid);
      if (profile) {
        this.user.status = profile.status || '😊 متاح';
      }
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
    this.chatContacts = [];
    
    for (const chat of chats) {
      const otherUserId = chat.participants.find(p => p !== this.currentUser?.uid);
      if (otherUserId) {
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
    
    this.filterData(); // Update filtered chats
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


 async saveStatus(): Promise<void> {
    if (this.tempStatus.trim() && this.currentUser) {
      try {
        await this.authService.updateUserStatusText(this.currentUser.uid, this.tempStatus.trim());
        this.user.status = this.tempStatus.trim();
        this.cancelStatusEdit();
      } catch (error) {
        console.error('Error updating status:', error);
      }
    }
  }

  cancelStatusEdit(): void {
    this.isEditingStatus = false;
    this.tempStatus = '';
  }

  async setQuickStatus(status: StatusOption): Promise<void> {
    const newStatus = `${status.emoji} ${status.text}`;
    if (this.currentUser) {
      try {
        await this.authService.updateUserStatusText(this.currentUser.uid, newStatus);
        this.user.status = newStatus;
      } catch (error) {
        console.error('Error setting quick status:', error);
      }
    }
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
   onImageUpload(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.user.profileImage = e.target.result;
        // يمكن إضافة رفع الصورة إلى Firebase Storage هنا
      };
      reader.readAsDataURL(file);
    }
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
      const chatId = await this.chatService.startChatWithUser(this.currentUser.uid, user.uid);
      
      const newContact: ChatContact = {
        id: user.uid,
        name: user.displayName || 'مستخدم',
        avatar: user.displayName?.charAt(0).toUpperCase() || 'M',
        status: '😊 متاح',
        isOnline: user.isOnline || false,
        chatId: chatId,
        isActive: false
      };

      // إضافة جهة الاتصال إذا لم تكن موجودة
      const existingContact = this.chatContacts.find(c => c.id === user.uid);
      if (!existingContact) {
        this.chatContacts.unshift(newContact);
      }

      // تحديد جهة الاتصال
      this.selectContact(existingContact || newContact);
      this.showUsersList = false;
    } catch (error) {
      console.error('Error starting chat:', error);
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
  async signOut(): Promise<void> {
    try {
      await this.authService.signOutUser();
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }
   // Utility method to refresh users list
  refreshUsersList(): void {
    this.loadAllUsers();
  }
 
  }
// (Remove this entire duplicate block. The previous declarations and methods already exist above.)