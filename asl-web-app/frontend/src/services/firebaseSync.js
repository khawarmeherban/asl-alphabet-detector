import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { firestore } from './firebase';

const HISTORY_COLLECTION = 'conversationHistory';
const PRACTICE_COLLECTION = 'practiceSessions';

function normalizeTimestamp(value) {
  if (!value) {
    return new Date().toISOString();
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate().toISOString();
  }

  return new Date(value).toISOString();
}

export async function saveConversationEntry(entry) {
  try {
    await addDoc(collection(firestore, HISTORY_COLLECTION), {
      ...entry,
      createdAt: serverTimestamp(),
      timestamp: entry.timestamp || new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Failed to save conversation entry to Firestore.', error);
    return false;
  }
}

export async function fetchConversationHistory() {
  try {
    const historyQuery = query(
      collection(firestore, HISTORY_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    const snapshot = await getDocs(historyQuery);
    return snapshot.docs.map((snapshotDoc) => {
      const data = snapshotDoc.data();
      return {
        id: snapshotDoc.id,
        ...data,
        timestamp: normalizeTimestamp(data.createdAt || data.timestamp)
      };
    });
  } catch (error) {
    console.error('Failed to fetch Firestore conversation history.', error);
    return [];
  }
}

export async function clearConversationHistory() {
  try {
    const snapshot = await getDocs(collection(firestore, HISTORY_COLLECTION));
    await Promise.all(snapshot.docs.map((item) => deleteDoc(doc(firestore, HISTORY_COLLECTION, item.id))));
    return true;
  } catch (error) {
    console.error('Failed to clear Firestore conversation history.', error);
    return false;
  }
}

export async function savePracticeSnapshot(sessionId, snapshot) {
  try {
    await setDoc(
      doc(firestore, PRACTICE_COLLECTION, sessionId),
      {
        ...snapshot,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.error('Failed to save practice snapshot.', error);
    return false;
  }
}

function countLettersFromText(entries) {
  return entries.reduce((accumulator, entry) => {
    String(entry.committedWord || entry.text || '')
      .toLowerCase()
      .replace(/[^a-z]/g, '')
      .split('')
      .forEach((letter) => {
        accumulator[letter] = (accumulator[letter] || 0) + 1;
      });

    return accumulator;
  }, {});
}

export async function fetchAnalyticsSummary(localLetterHistory = []) {
  const history = await fetchConversationHistory();
  const practiceSnapshotDocs = await getDocs(collection(firestore, PRACTICE_COLLECTION)).catch(() => null);
  const practiceSnapshots = practiceSnapshotDocs
    ? practiceSnapshotDocs.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() }))
    : [];

  const allLetterCounts = countLettersFromText(history);
  localLetterHistory.forEach((item) => {
    const letter = String(item.letter || '').toLowerCase();
    if (letter) {
      allLetterCounts[letter] = (allLetterCounts[letter] || 0) + 1;
    }
  });

  const aslMessages = history.filter((entry) => entry.mode === 'ASL').length;
  const voiceMessages = history.filter((entry) => entry.mode === 'Voice').length;

  return {
    total_messages: history.length,
    asl_messages: aslMessages,
    voice_messages: voiceMessages,
    letter_frequency: allLetterCounts,
    most_used_letters: Object.entries(allLetterCounts).sort((left, right) => right[1] - left[1]).slice(0, 10),
    practice_sessions: practiceSnapshots.length,
    best_practice_score: practiceSnapshots.reduce(
      (best, item) => Math.max(best, Number(item.score || 0)),
      0
    ),
    best_streak: practiceSnapshots.reduce(
      (best, item) => Math.max(best, Number(item.streak || 0)),
      0
    )
  };
}
