import { auth, db } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

export const signUpUser = async (email: string, password: string, username: string) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Initialize Firestore profile document for the user (vitals stored in subcollection)
  await setDoc(doc(db, 'users', user.uid), {
    username,
    email,
    classificationResult: null,
    createdAt: new Date().toISOString(),
  });
  return user;
};

export const loginUser = async (email: string, password: string) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

export const fetchUserProfile = async (uid: string) => {
  const userDoc = await getDoc(doc(db, 'users', uid));
  return userDoc.exists() ? userDoc.data() : null;
};

export async function updateUserDisplayName(uid: string, displayName: string): Promise<void> {
  const normalizedName = displayName.trim().replace(/\s+/g, ' ');
  if (!/^[A-Za-z][A-Za-z '-]{0,39}$/.test(normalizedName)) {
    throw new Error('Use 1–40 characters: letters, spaces, apostrophes, or hyphens.');
  }

  await updateDoc(doc(db, 'users', uid), { username: normalizedName });
}
