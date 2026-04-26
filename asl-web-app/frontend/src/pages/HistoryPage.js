import React, { useEffect, useState } from 'react';
import { Trash2, Volume2, Clock, User } from 'lucide-react';
import { clearConversationHistory, fetchConversationHistory } from '../services/firebaseSync';

function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    const remoteHistory = await fetchConversationHistory();
    setHistory(remoteHistory);
    setLoading(false);
  };

  const clearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear all synced history?')) {
      return;
    }

    const cleared = await clearConversationHistory();
    if (cleared) {
      setHistory([]);
      window.alert('Firebase history cleared successfully.');
    } else {
      window.alert('Failed to clear Firebase history. Check Firestore rules.');
    }
  };

  const speakText = (text) => {
    if (!('speechSynthesis' in window)) {
      window.alert('Speech synthesis is not available in this browser.');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(String(text || ''));
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredHistory = history.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'asl') return item.mode === 'ASL';
    if (filter === 'voice') return item.mode === 'Voice';
    return true;
  });

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-2xl text-white">Loading conversation history.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Conversation History</h2>
            <p className="mt-1 text-gray-600">
              {history.length} {history.length === 1 ? 'entry' : 'entries'} available
            </p>
          </div>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              className="flex items-center space-x-2 rounded-lg bg-red-500 px-6 py-3 font-semibold text-white transition-all hover:bg-red-600"
            >
              <Trash2 size={20} />
              <span>Clear All</span>
            </button>
          )}
        </div>

        {history.length > 0 && (
          <div className="mb-6 flex space-x-3">
            <button
              onClick={() => setFilter('all')}
              className={`rounded-lg px-6 py-2 font-semibold transition-all ${
                filter === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All ({history.length})
            </button>
            <button
              onClick={() => setFilter('asl')}
              className={`rounded-lg px-6 py-2 font-semibold transition-all ${
                filter === 'asl' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              ASL ({history.filter((item) => item.mode === 'ASL').length})
            </button>
            <button
              onClick={() => setFilter('voice')}
              className={`rounded-lg px-6 py-2 font-semibold transition-all ${
                filter === 'voice' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Voice ({history.filter((item) => item.mode === 'Voice').length})
            </button>
          </div>
        )}

        {filteredHistory.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mb-4 text-6xl">💬</div>
            <h3 className="mb-2 text-2xl font-bold text-gray-700">No conversation records yet</h3>
            <p className="text-gray-500">
              {filter === 'all' ? 'Saved ASL and voice sessions will appear here.' : `No ${filter} records are available yet.`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHistory.map((item) => (
              <div
                key={item.id || `${item.timestamp}-${item.text}`}
                className={`card transition-shadow hover:shadow-lg ${
                  item.mode === 'ASL' ? 'bg-blue-50' : 'bg-green-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center space-x-3">
                      <span className="text-2xl">{item.mode === 'ASL' ? '🤟' : '🎤'}</span>
                      <span className={`rounded-full px-3 py-1 text-sm font-semibold ${
                        item.mode === 'ASL' ? 'bg-blue-200 text-blue-800' : 'bg-green-200 text-green-800'
                      }`}>
                        {item.mode}
                      </span>
                      <div className="flex items-center text-sm text-gray-500">
                        <User size={14} className="mr-1" />
                        {item.speaker || 'User'}
                      </div>
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock size={14} className="mr-1" />
                        {formatTimestamp(item.timestamp)}
                      </div>
                    </div>
                    <p className="text-xl text-gray-800">{item.sentenceSnapshot || item.text}</p>
                  </div>
                  <button
                    onClick={() => speakText(item.text)}
                    className="ml-4 rounded-lg bg-white p-3 transition-colors hover:bg-gray-100"
                    title="Speak this message"
                  >
                    <Volume2 size={20} className="text-purple-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default HistoryPage;
