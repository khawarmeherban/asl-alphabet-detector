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
const LOCAL_HISTORY_KEY = 'alphahand-conversation-history';
const LOCAL_PRACTICE_KEY = 'alphahand-practice-snapshots';

function readLocalJson(key, fallbackValue) {
  if (typeof window === 'undefined') {
    return fallbackValue;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

function writeLocalJson(key, value) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage write failures and preserve app behavior.
  }
}

function normalizeTimestamp(value) {
  if (!value) {
    return new Date().toISOString();
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate().toISOString();
  }

  return new Date(value).toISOString();
}

function normalizeHistoryEntry(entry, fallbackId) {
  return {
    id: entry.id || fallbackId,
    ...entry,
    timestamp: normalizeTimestamp(entry.createdAt || entry.timestamp)
  };
}

function getLocalConversationHistory() {
  return readLocalJson(LOCAL_HISTORY_KEY, [])
    .map((entry, index) => normalizeHistoryEntry(entry, entry.id || `local-history-${index}`))
    .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp));
}

function saveLocalConversationEntry(entry) {
  const current = getLocalConversationHistory();
  const nextEntry = normalizeHistoryEntry(
    {
      ...entry,
      id: entry.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: entry.createdAt || entry.timestamp || new Date().toISOString(),
      timestamp: entry.timestamp || new Date().toISOString()
    },
    entry.id
  );
  writeLocalJson(LOCAL_HISTORY_KEY, [nextEntry, ...current].slice(0, 100));
  return nextEntry;
}

function mergeConversationHistory(remoteHistory, localHistory) {
  const merged = new Map();

  [...remoteHistory, ...localHistory].forEach((entry, index) => {
    const key = entry.id || `${entry.timestamp}-${entry.text}-${index}`;
    if (!merged.has(key)) {
      merged.set(key, normalizeHistoryEntry(entry, key));
    }
  });

  return [...merged.values()].sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp));
}

function getLocalPracticeSnapshots() {
  return readLocalJson(LOCAL_PRACTICE_KEY, {});
}

export async function saveConversationEntry(entry) {
  const localEntry = saveLocalConversationEntry(entry);

  try {
    await addDoc(collection(firestore, HISTORY_COLLECTION), {
      ...entry,
      createdAt: serverTimestamp(),
      timestamp: entry.timestamp || new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Failed to save conversation entry to Firestore.', error);
    return Boolean(localEntry);
  }
}

export async function fetchConversationHistory() {
  const localHistory = getLocalConversationHistory();

  try {
    const historyQuery = query(
      collection(firestore, HISTORY_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    const snapshot = await getDocs(historyQuery);
    const remoteHistory = snapshot.docs.map((snapshotDoc) => {
      const data = snapshotDoc.data();
      return normalizeHistoryEntry(
        {
          id: snapshotDoc.id,
          ...data
        },
        snapshotDoc.id
      );
    });
    return mergeConversationHistory(remoteHistory, localHistory);
  } catch (error) {
    console.error('Failed to fetch Firestore conversation history.', error);
    return localHistory;
  }
}

export async function clearConversationHistory() {
  writeLocalJson(LOCAL_HISTORY_KEY, []);

  try {
    const snapshot = await getDocs(collection(firestore, HISTORY_COLLECTION));
    await Promise.all(snapshot.docs.map((item) => deleteDoc(doc(firestore, HISTORY_COLLECTION, item.id))));
    return true;
  } catch (error) {
    console.error('Failed to clear Firestore conversation history.', error);
    return true;
  }
}

export async function savePracticeSnapshot(sessionId, snapshot) {
  const localSnapshots = getLocalPracticeSnapshots();
  writeLocalJson(LOCAL_PRACTICE_KEY, {
    ...localSnapshots,
    [sessionId]: {
      ...(localSnapshots[sessionId] || {}),
      ...snapshot,
      updatedAt: snapshot.updatedAt || new Date().toISOString()
    }
  });

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
    return true;
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
  const remotePracticeSnapshots = practiceSnapshotDocs
    ? practiceSnapshotDocs.docs.map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() }))
    : [];
  const localPracticeSnapshots = Object.entries(getLocalPracticeSnapshots()).map(([id, snapshot]) => ({
    id,
    ...snapshot
  }));
  const practiceSnapshots = [...remotePracticeSnapshots, ...localPracticeSnapshots].reduce((accumulator, item) => {
    if (!accumulator.some((existing) => existing.id === item.id)) {
      accumulator.push(item);
    }
    return accumulator;
  }, []);

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
