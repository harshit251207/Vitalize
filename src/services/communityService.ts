import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { auth, db, storage } from '@/services/firebase';
import type { DisabilityCategory } from '@/lib/categoryStorage';

export const POST_CATEGORIES = ['Tips', 'Questions', 'Motivation', 'Exercise'] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];
export type ReportReason = 'Spam' | 'Harassment' | 'Unsafe medical advice' | 'Other';

export interface CommunityPost {
  id: string;
  text: string;
  imagePath: string | null;
  authorId: string;
  authorName: string;
  isAnonymous: boolean;
  category: PostCategory;
  conditionCategory: DisabilityCategory | 'unknown';
  createdAt: Date | null;
  likeCount: number;
  commentCount: number;
  reportCount: number;
  hidden: boolean;
}

export function safeFirstName(value: string): string {
  const firstName = value.trim().split(/\s+/)[0] ?? '';
  return /^[A-Za-z][A-Za-z'-]{0,39}$/.test(firstName) ? firstName : 'Community member';
}

export interface CommunityComment {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  isAnonymous: boolean;
  createdAt: Date | null;
}

export class CommunityServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommunityServiceError';
  }
}

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new CommunityServiceError('Sign in to use the community.');
  return uid;
}

function postsCollection() {
  return collection(db, 'posts');
}

function postDocument(postId: string) {
  return doc(db, 'posts', postId);
}

function asDate(value: unknown): Date | null {
  if (value && typeof value === 'object' && 'toDate' in value &&
      typeof value.toDate === 'function') {
    return value.toDate();
  }
  return value instanceof Date ? value : null;
}

function mapPost(id: string, data: DocumentData): CommunityPost {
  return {
    id,
    text: typeof data.text === 'string' ? data.text : '',
    imagePath: typeof data.imagePath === 'string' ? data.imagePath : null,
    authorId: typeof data.authorId === 'string' ? data.authorId : '',
    authorName: typeof data.authorName === 'string' ? data.authorName : 'Community member',
    isAnonymous: data.isAnonymous === true,
    category: data.category as PostCategory,
    conditionCategory: data.conditionCategory as DisabilityCategory | 'unknown',
    createdAt: asDate(data.createdAt),
    likeCount: typeof data.likeCount === 'number' ? data.likeCount : 0,
    commentCount: typeof data.commentCount === 'number' ? data.commentCount : 0,
    reportCount: typeof data.reportCount === 'number' ? data.reportCount : 0,
    hidden: data.hidden === true,
  };
}

function mapComment(id: string, data: DocumentData): CommunityComment {
  return {
    id,
    text: typeof data.text === 'string' ? data.text : '',
    authorId: typeof data.authorId === 'string' ? data.authorId : '',
    authorName: typeof data.authorName === 'string' ? data.authorName : 'Community member',
    isAnonymous: data.isAnonymous === true,
    createdAt: asDate(data.createdAt),
  };
}

function postQueryConstraints(
  category: PostCategory | null,
  condition: DisabilityCategory | null,
  sortOrder: 'newest' | 'oldest',
): QueryConstraint[] {
  const constraints: QueryConstraint[] = [where('hidden', '==', false)];
  if (category) constraints.push(where('category', '==', category));
  if (condition) constraints.push(where('conditionCategory', '==', condition));
  constraints.push(orderBy('createdAt', sortOrder === 'newest' ? 'desc' : 'asc'), limit(30));
  return constraints;
}

export function subscribeToPosts(
  category: PostCategory | null,
  condition: DisabilityCategory | null,
  sortOrder: 'newest' | 'oldest',
  onPosts: (
    posts: CommunityPost[],
    snapshots: QueryDocumentSnapshot<DocumentData>[],
    isFromCache: boolean,
  ) => void,
  onError: (error: Error) => void,
): () => void {
  requireUid();
  const postsQuery = query(postsCollection(), ...postQueryConstraints(category, condition, sortOrder));
  return onSnapshot(
    postsQuery,
    { includeMetadataChanges: true },
    (snapshot) => onPosts(
      snapshot.docs.map((post) => mapPost(post.id, post.data())),
      snapshot.docs,
      snapshot.metadata.fromCache,
    ),
    onError,
  );
}

export async function loadMorePosts(
  category: PostCategory | null,
  condition: DisabilityCategory | null,
  sortOrder: 'newest' | 'oldest',
  cursor: QueryDocumentSnapshot<DocumentData>,
): Promise<{ posts: CommunityPost[]; snapshots: QueryDocumentSnapshot<DocumentData>[] }> {
  requireUid();
  const constraints = postQueryConstraints(category, condition, sortOrder).filter(
    (constraint) => constraint.type !== 'limit',
  );
  const pageQuery = query(postsCollection(), ...constraints, startAfter(cursor), limit(30));
  const snapshot = await getDocs(pageQuery);
  return {
    posts: snapshot.docs.map((post) => mapPost(post.id, post.data())),
    snapshots: snapshot.docs,
  };
}

export async function createCommunityPost(input: {
  text: string;
  image?: { uri: string; width: number; height: number } | null;
  authorName: string;
  isAnonymous: boolean;
  category: PostCategory;
  conditionCategory: DisabilityCategory | null;
}): Promise<void> {
  const uid = requireUid();
  const text = input.text.trim();
  if ((!text && !input.image) || text.length > 500) {
    throw new CommunityServiceError('Posts need a photo or 1–500 characters of text.');
  }
  const postRef = doc(postsCollection());
  let imagePath: string | null = null;

  if (input.image) {
    const maxDimension = Math.max(input.image.width, input.image.height);
    const resizeAction =
      maxDimension > 1280
        ? input.image.width >= input.image.height
          ? [{ resize: { width: 1280 } }]
          : [{ resize: { height: 1280 } }]
        : [];
    const image = await manipulateAsync(
      input.image.uri,
      resizeAction,
      { compress: 0.78, format: SaveFormat.JPEG },
    );
    const response = await fetch(image.uri);
    const imageBlob = await response.blob();
    if (imageBlob.size > 5 * 1024 * 1024) {
      throw new CommunityServiceError('Please choose an image smaller than 5 MB.');
    }

    imagePath = `communityPosts/${uid}/${postRef.id}.jpg`;
    try {
      await uploadBytes(ref(storage, imagePath), imageBlob, { contentType: 'image/jpeg' });
    } catch (error) {
      throw new CommunityServiceError(
        error instanceof Error ? `Image upload failed: ${error.message}` : 'Image upload failed.',
      );
    }
  }

  try {
    await setDoc(postRef, {
      text,
      ...(imagePath ? { imagePath } : {}),
      authorId: uid,
      authorName: input.isAnonymous ? 'Anonymous' : safeFirstName(input.authorName),
      isAnonymous: input.isAnonymous,
      category: input.category,
      conditionCategory: input.conditionCategory ?? 'unknown',
      createdAt: serverTimestamp(),
      likeCount: 0,
      commentCount: 0,
      reportCount: 0,
      hidden: false,
    });
  } catch (error) {
    if (imagePath) {
      try {
        await deleteObject(ref(storage, imagePath));
      } catch (cleanupError) {
        console.warn('[Community] Could not clean up failed post image upload:', cleanupError);
      }
    }
    throw error;
  }
}

export async function getCommunityImageUrl(imagePath: string): Promise<string> {
  requireUid();
  return getDownloadURL(ref(storage, imagePath));
}

export async function togglePostLike(postId: string): Promise<boolean> {
  const uid = requireUid();
  const postRef = postDocument(postId);
  const likeRef = doc(db, 'posts', postId, 'likes', uid);

  return runTransaction(db, async (transaction) => {
    const [postSnapshot, likeSnapshot] = await Promise.all([
      transaction.get(postRef),
      transaction.get(likeRef),
    ]);
    if (!postSnapshot.exists()) throw new CommunityServiceError('This post is no longer available.');
    const currentCount = Number(postSnapshot.data().likeCount) || 0;

    if (likeSnapshot.exists()) {
      transaction.delete(likeRef);
      transaction.update(postRef, { likeCount: Math.max(0, currentCount - 1) });
      return false;
    }

    transaction.set(likeRef, { createdAt: serverTimestamp() });
    transaction.update(postRef, { likeCount: currentCount + 1 });
    return true;
  });
}

export async function subscribeToPostLike(
  postId: string,
  onLiked: (liked: boolean) => void,
  onError: (error: Error) => void,
): Promise<() => void> {
  const uid = requireUid();
  return onSnapshot(
    doc(db, 'posts', postId, 'likes', uid),
    (snapshot) => onLiked(snapshot.exists()),
    onError,
  );
}

export function subscribeToComments(
  postId: string,
  onComments: (comments: CommunityComment[]) => void,
  onError: (error: Error) => void,
): () => void {
  requireUid();
  const commentsQuery = query(
    collection(db, 'posts', postId, 'comments'),
    orderBy('createdAt', 'asc'),
  );
  return onSnapshot(
    commentsQuery,
    (snapshot) => onComments(snapshot.docs.map((comment) => mapComment(comment.id, comment.data()))),
    onError,
  );
}

export async function createComment(
  postId: string,
  input: { text: string; authorName: string },
): Promise<void> {
  const uid = requireUid();
  const text = input.text.trim();
  if (!text || text.length > 300) throw new CommunityServiceError('Comments must be 1–300 characters.');
  const postRef = postDocument(postId);
  const commentRef = doc(collection(db, 'posts', postId, 'comments'));

  await runTransaction(db, async (transaction) => {
    const postSnapshot = await transaction.get(postRef);
    if (!postSnapshot.exists()) throw new CommunityServiceError('This post is no longer available.');
    const count = Number(postSnapshot.data().commentCount) || 0;
    transaction.set(commentRef, {
      text,
      authorId: uid,
      authorName: safeFirstName(input.authorName),
      isAnonymous: false,
      createdAt: serverTimestamp(),
    });
    transaction.update(postRef, { commentCount: count + 1 });
  });
}

export async function deleteComment(postId: string, commentId: string): Promise<void> {
  const uid = requireUid();
  const postRef = postDocument(postId);
  const commentRef = doc(db, 'posts', postId, 'comments', commentId);

  await runTransaction(db, async (transaction) => {
    const [postSnapshot, commentSnapshot] = await Promise.all([
      transaction.get(postRef),
      transaction.get(commentRef),
    ]);
    if (!commentSnapshot.exists() || commentSnapshot.data().authorId !== uid) {
      throw new CommunityServiceError('You can only delete your own comment.');
    }
    const count = postSnapshot.exists() ? Number(postSnapshot.data().commentCount) || 0 : 0;
    transaction.delete(commentRef);
    if (postSnapshot.exists()) {
      transaction.update(postRef, { commentCount: Math.max(0, count - 1) });
    }
  });
}

export async function reportPost(postId: string, reason: ReportReason): Promise<boolean> {
  const uid = requireUid();
  const postRef = postDocument(postId);
  const reportRef = doc(db, 'posts', postId, 'reports', uid);

  return runTransaction(db, async (transaction) => {
    const [postSnapshot, reportSnapshot] = await Promise.all([
      transaction.get(postRef),
      transaction.get(reportRef),
    ]);
    if (!postSnapshot.exists()) throw new CommunityServiceError('This post is no longer available.');
    if (postSnapshot.data().authorId === uid) {
      throw new CommunityServiceError('You cannot report your own post.');
    }
    if (reportSnapshot.exists()) return false;

    const count = (Number(postSnapshot.data().reportCount) || 0) + 1;
    transaction.set(reportRef, { reason, createdAt: serverTimestamp() });
    transaction.update(postRef, { reportCount: count, hidden: count >= 3 });
    return true;
  });
}

export async function deleteCommunityPost(postId: string): Promise<void> {
  const uid = requireUid();
  const postRef = postDocument(postId);
  const snapshot = await getDoc(postRef);
  if (!snapshot.exists() || snapshot.data().authorId !== uid) {
    throw new CommunityServiceError('You can only delete your own post.');
  }
  const imagePath = typeof snapshot.data().imagePath === 'string'
    ? snapshot.data().imagePath
    : null;
  await deleteDoc(postRef);
  if (imagePath) {
    try {
      await deleteObject(ref(storage, imagePath));
    } catch (error) {
      console.warn('[Community] Could not delete post image from storage:', error);
    }
  }
}

export type FeedCursor = QueryDocumentSnapshot<DocumentData>;
