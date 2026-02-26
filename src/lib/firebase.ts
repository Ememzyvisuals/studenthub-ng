// Firebase Configuration for StudentHub NG
// Using Firebase Realtime Database (FREE - no billing required)

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import {
  getDatabase,
  ref,
  set,
  get,
  push,
  update,
  remove,
  onValue,
  query,
  orderByChild,
  limitToLast,
  off
} from 'firebase/database';

// Firebase configuration - uses environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

// Check if Firebase is configured
export const isFirebaseConfigured = (): boolean => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.databaseURL
  );
};

// Initialize Firebase only if configured
let app: ReturnType<typeof initializeApp> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;
let database: ReturnType<typeof getDatabase> | null = null;

if (isFirebaseConfigured()) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    database = getDatabase(app);
    console.log('Firebase initialized successfully (Realtime Database)');
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
} else {
  console.log('Firebase not configured - running in offline mode with IndexedDB');
}

export { app, auth, database as db };

// Auth functions
export const firebaseSignUp = async (
  email: string, 
  password: string, 
  name: string, 
  level: string
) => {
  if (!auth || !database) throw new Error('Firebase not configured');
  
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  
  // Create user in Realtime Database
  await set(ref(database, `users/${user.uid}`), {
    id: user.uid,
    name,
    email,
    level,
    createdAt: Date.now(),
    questionsAnswered: 0,
    correctAnswers: 0,
    streak: 0,
    lastActiveDate: new Date().toDateString(),
    badges: [],
    mockExamsTaken: 0
  });
  
  return user;
};

export const firebaseSignIn = async (email: string, password: string) => {
  if (!auth) throw new Error('Firebase not configured');
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

export const firebaseSignOut = async () => {
  if (!auth) throw new Error('Firebase not configured');
  await signOut(auth);
};

export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

// User functions
export const getUserData = async (userId: string) => {
  if (!database) return null;
  const snapshot = await get(ref(database, `users/${userId}`));
  return snapshot.exists() ? snapshot.val() : null;
};

export const updateUserData = async (userId: string, data: Record<string, unknown>) => {
  if (!database) return;
  await update(ref(database, `users/${userId}`), data);
};

export const getAllUsers = async () => {
  if (!database) return [];
  const snapshot = await get(ref(database, 'users'));
  if (!snapshot.exists()) return [];
  
  const users: Array<{id: string; [key: string]: unknown}> = [];
  snapshot.forEach((child) => {
    users.push({ id: child.key!, ...child.val() });
  });
  return users;
};

// Increment helper for Realtime Database
const incrementValue = async (path: string, amount: number = 1) => {
  if (!database) return;
  const snapshot = await get(ref(database, path));
  const currentValue = snapshot.exists() ? snapshot.val() : 0;
  await set(ref(database, path), currentValue + amount);
};

// Forum functions
export const createPost = async (userId: string, userName: string, userLevel: string, content: string) => {
  if (!database) throw new Error('Firebase not configured');
  
  const postsRef = ref(database, 'posts');
  const newPostRef = push(postsRef);
  
  await set(newPostRef, {
    userId,
    userName,
    userLevel,
    content,
    likes: 0,
    createdAt: Date.now()
  });
  
  return newPostRef.key;
};

export const getPosts = async () => {
  if (!database) return [];
  
  const postsQuery = query(
    ref(database, 'posts'),
    orderByChild('createdAt'),
    limitToLast(100)
  );
  
  const snapshot = await get(postsQuery);
  if (!snapshot.exists()) return [];
  
  const posts: Array<{id: string; createdAt: Date; [key: string]: unknown}> = [];
  snapshot.forEach((child) => {
    const data = child.val();
    posts.push({ 
      id: child.key!, 
      ...data,
      createdAt: new Date(data.createdAt)
    });
  });
  
  // Sort by createdAt descending (newest first)
  return posts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

export const subscribeToPosts = (callback: (posts: unknown[]) => void) => {
  if (!database) return () => {};
  
  const db = database; // Store local reference for TypeScript
  const postsRef = ref(db, 'posts');
  
  onValue(postsRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    
    const posts: Array<{id: string; createdAt: Date; [key: string]: unknown}> = [];
    snapshot.forEach((child) => {
      const data = child.val();
      posts.push({
        id: child.key!,
        ...data,
        createdAt: new Date(data.createdAt)
      });
    });
    
    // Sort by createdAt descending
    posts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    callback(posts);
  });
  
  return () => off(postsRef);
};

export const deletePost = async (postId: string) => {
  if (!database) return;
  const db = database; // Store local reference
  await remove(ref(db, `posts/${postId}`));
  // Also delete associated comments
  const commentsSnapshot = await get(ref(db, 'comments'));
  if (commentsSnapshot.exists()) {
    commentsSnapshot.forEach((child) => {
      if (child.val().postId === postId) {
        remove(ref(db, `comments/${child.key}`));
      }
    });
  }
};

export const likePost = async (postId: string, userId: string) => {
  if (!database) return;
  
  // Check if already liked
  const likeRef = ref(database, `likes/${postId}_${userId}`);
  const likeSnapshot = await get(likeRef);
  
  if (!likeSnapshot.exists()) {
    // Add like
    await set(likeRef, { postId, userId, createdAt: Date.now() });
    await incrementValue(`posts/${postId}/likes`, 1);
  } else {
    // Remove like
    await remove(likeRef);
    await incrementValue(`posts/${postId}/likes`, -1);
  }
};

// Check if user has liked a post
export const hasUserLikedPost = async (postId: string, userId: string) => {
  if (!database) return false;
  const db = database; // Non-null assertion for TypeScript
  const likeRef = ref(db, `likes/${postId}_${userId}`);
  const snapshot = await get(likeRef);
  return snapshot.exists();
};

// Comments
export const addComment = async (postId: string, userId: string, userName: string, content: string) => {
  if (!database) throw new Error('Firebase not configured');
  
  const commentsRef = ref(database, 'comments');
  const newCommentRef = push(commentsRef);
  
  await set(newCommentRef, {
    postId,
    userId,
    userName,
    content,
    createdAt: Date.now()
  });
  
  return newCommentRef.key;
};

export const getComments = async (postId: string) => {
  if (!database) return [];
  
  const snapshot = await get(ref(database, 'comments'));
  if (!snapshot.exists()) return [];
  
  const comments: Array<{id: string; createdAt: Date; [key: string]: unknown}> = [];
  snapshot.forEach((child) => {
    const data = child.val();
    if (data.postId === postId) {
      comments.push({
        id: child.key!,
        ...data,
        createdAt: new Date(data.createdAt)
      });
    }
  });
  
  // Sort by createdAt descending
  return comments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

export const subscribeToComments = (postId: string, callback: (comments: unknown[]) => void) => {
  if (!database) return () => {};
  
  const db = database; // TypeScript non-null assertion
  const commentsRef = ref(db, 'comments');
  
  onValue(commentsRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    
    const comments: Array<{id: string; createdAt: Date; [key: string]: unknown}> = [];
    snapshot.forEach((child) => {
      const data = child.val();
      if (data.postId === postId) {
        comments.push({
          id: child.key!,
          ...data,
          createdAt: new Date(data.createdAt)
        });
      }
    });
    
    comments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    callback(comments);
  });
  
  return () => off(commentsRef);
};

// Mock exam results
export const saveMockResult = async (userId: string, result: Record<string, unknown>) => {
  if (!database) throw new Error('Firebase not configured');
  
  const resultsRef = ref(database, 'mockResults');
  const newResultRef = push(resultsRef);
  
  await set(newResultRef, {
    userId,
    ...result,
    createdAt: Date.now()
  });
  
  // Update user stats
  await incrementValue(`users/${userId}/mockExamsTaken`, 1);
  
  return newResultRef.key;
};

export const getUserMockResults = async (userId: string) => {
  if (!database) return [];
  
  const snapshot = await get(ref(database, 'mockResults'));
  if (!snapshot.exists()) return [];
  
  const results: Array<{id: string; createdAt: Date; [key: string]: unknown}> = [];
  snapshot.forEach((child) => {
    const data = child.val();
    if (data.userId === userId) {
      results.push({
        id: child.key!,
        ...data,
        createdAt: new Date(data.createdAt)
      });
    }
  });
  
  // Sort by createdAt descending
  return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

// Flashcards
export const saveFlashcard = async (userId: string, flashcard: Record<string, unknown>) => {
  if (!database) throw new Error('Firebase not configured');
  
  const flashcardsRef = ref(database, 'flashcards');
  const newFlashcardRef = push(flashcardsRef);
  
  await set(newFlashcardRef, {
    userId,
    ...flashcard,
    createdAt: Date.now()
  });
  
  return newFlashcardRef.key;
};

export const getUserFlashcards = async (userId: string) => {
  if (!database) return [];
  
  const snapshot = await get(ref(database, 'flashcards'));
  if (!snapshot.exists()) return [];
  
  const flashcards: Array<{id: string; [key: string]: unknown}> = [];
  snapshot.forEach((child) => {
    const data = child.val();
    if (data.userId === userId) {
      flashcards.push({
        id: child.key!,
        ...data
      });
    }
  });
  
  return flashcards;
};

export const updateFlashcard = async (flashcardId: string, data: Record<string, unknown>) => {
  if (!database) return;
  await update(ref(database, `flashcards/${flashcardId}`), data);
};

export const deleteFlashcard = async (flashcardId: string) => {
  if (!database) return;
  await remove(ref(database, `flashcards/${flashcardId}`));
};

// Feedback
export const saveFeedback = async (userId: string, rating: number, review: string) => {
  if (!database) throw new Error('Firebase not configured');
  
  const feedbackRef = ref(database, 'feedback');
  const newFeedbackRef = push(feedbackRef);
  
  await set(newFeedbackRef, {
    userId,
    rating,
    review,
    createdAt: Date.now()
  });
  
  return newFeedbackRef.key;
};

export const getAllFeedback = async () => {
  if (!database) return [];
  
  const snapshot = await get(ref(database, 'feedback'));
  if (!snapshot.exists()) return [];
  
  const feedback: Array<{id: string; createdAt: Date; [key: string]: unknown}> = [];
  snapshot.forEach((child) => {
    const data = child.val();
    feedback.push({
      id: child.key!,
      ...data,
      createdAt: new Date(data.createdAt)
    });
  });
  
  return feedback.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};

// Analytics
export const updateAnalytics = async (field: string, value: number) => {
  if (!database) return;
  
  const today = new Date().toISOString().split('T')[0];
  await incrementValue(`analytics/${today}/${field}`, value);
};

export const getAnalytics = async (days: number = 7) => {
  if (!database) return [];
  
  const snapshot = await get(ref(database, 'analytics'));
  if (!snapshot.exists()) return [];
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const analytics: Array<{id: string; [key: string]: unknown}> = [];
  snapshot.forEach((child) => {
    const dateStr = child.key!;
    if (new Date(dateStr) >= startDate) {
      analytics.push({
        id: dateStr,
        date: dateStr,
        ...child.val()
      });
    }
  });
  
  return analytics;
};

// Uploaded Questions (for admin)
export const uploadQuestion = async (question: Record<string, unknown>) => {
  if (!database) throw new Error('Firebase not configured');
  
  const questionsRef = ref(database, 'uploadedQuestions');
  const newQuestionRef = push(questionsRef);
  
  await set(newQuestionRef, {
    ...question,
    uploadedAt: Date.now(),
    isActive: true
  });
  
  return newQuestionRef.key;
};

export const uploadQuestionsBulk = async (questions: Array<Record<string, unknown>>) => {
  if (!database) throw new Error('Firebase not configured');
  
  const results = await Promise.all(
    questions.map(q => uploadQuestion(q))
  );
  
  return results;
};

export const getAllUploadedQuestions = async () => {
  if (!database) return [];
  
  const snapshot = await get(ref(database, 'uploadedQuestions'));
  if (!snapshot.exists()) return [];
  
  const questions: Array<{id: string; [key: string]: unknown}> = [];
  snapshot.forEach((child) => {
    questions.push({
      id: child.key!,
      ...child.val()
    });
  });
  
  return questions;
};

export const updateUploadedQuestion = async (questionId: string, data: Record<string, unknown>) => {
  if (!database) return;
  await update(ref(database, `uploadedQuestions/${questionId}`), data);
};

export const deleteUploadedQuestion = async (questionId: string) => {
  if (!database) return;
  await remove(ref(database, `uploadedQuestions/${questionId}`));
};

// Real-time user presence
export const setUserOnline = async (userId: string) => {
  if (!database) return;
  await set(ref(database, `presence/${userId}`), {
    online: true,
    lastSeen: Date.now()
  });
};

export const setUserOffline = async (userId: string) => {
  if (!database) return;
  await update(ref(database, `presence/${userId}`), {
    online: false,
    lastSeen: Date.now()
  });
};

export const getOnlineUsers = async () => {
  if (!database) return 0;
  
  const snapshot = await get(ref(database, 'presence'));
  if (!snapshot.exists()) return 0;
  
  let count = 0;
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  
  snapshot.forEach((child) => {
    const data = child.val();
    if (data.online && data.lastSeen > fiveMinutesAgo) {
      count++;
    }
  });
  
  return count;
};

export const subscribeToOnlineUsers = (callback: (count: number) => void) => {
  if (!database) return () => {};
  
  const presenceRef = ref(database, 'presence');
  
  onValue(presenceRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(0);
      return;
    }
    
    let count = 0;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    
    snapshot.forEach((child) => {
      const data = child.val();
      if (data.online && data.lastSeen > fiveMinutesAgo) {
        count++;
      }
    });
    
    callback(count);
  });
  
  return () => off(presenceRef);
};
