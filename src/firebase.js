import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBPzxls51Qm5Uzs8ZmeA3Mb20y1kpjOkXs",
  authDomain: "ages-tracker.firebaseapp.com",
  projectId: "ages-tracker",
  storageBucket: "ages-tracker.firebasestorage.app",
  messagingSenderId: "375652782386",
  appId: "1:375652782386:web:cad79b95f1b9499764472b",
  measurementId: "G-FPS4L47YZG",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

const ENQUIRIES_COLLECTION = "enquiries";

// Subscribe to real-time updates — callback fires whenever any team member adds/edits/deletes
export function subscribeToEnquiries(callback) {
  const q = query(collection(db, ENQUIRIES_COLLECTION), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const enquiries = snapshot.docs.map((d) => ({ ...d.data(), firestoreId: d.id }));
    callback(enquiries);
  }, (error) => {
    console.error("Firestore subscription error:", error);
  });
}

export async function addEnquiryToDb(enquiry) {
  return addDoc(collection(db, ENQUIRIES_COLLECTION), enquiry);
}

export async function updateEnquiryInDb(firestoreId, changes) {
  return updateDoc(doc(db, ENQUIRIES_COLLECTION, firestoreId), changes);
}

export async function deleteEnquiryFromDb(firestoreId) {
  return deleteDoc(doc(db, ENQUIRIES_COLLECTION, firestoreId));
}
