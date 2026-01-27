import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Trash2, Volume2, Clock, User } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, asl, voice

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API_URL}/history`);
      setHistory(response.data.history);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch history:', error);
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    if (window.confirm('Are you sure you want to clear all history?')) {
      try {
        await axios.delete(`${API_URL}/history`);
        setHistory([]);
        alert('History cleared successfully!');
      } catch (error) {
        console.error('Failed to clear history:', error);
        alert('Failed to clear history');
      }
    }
  };

  const speakText = async (text) => {
    try {
      await axios.post(`${API_URL}/speak`, { text });
    } catch (error) {
      console.error('TTS error:', error);
    }
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

  const filteredHistory = history.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'asl') return item.mode === 'ASL';
    if (filter === 'voice') return item.mode === 'Voice';
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white text-2xl">Loading history...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Conversation History</h2>
            <p className="text-gray-600 mt-1">
              {history.length} {history.length === 1 ? 'message' : 'messages'} recorded
            </p>
          </div>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-semibold transition-all flex items-center space-x-2"
            >
              <Trash2 size={20} />
              <span>Clear All</span>
            </button>
          )}
        </div>

        {/* Filters */}
        {history.length > 0 && (
          <div className="flex space-x-3 mb-6">
            <button
              onClick={() => setFilter('all')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                filter === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All ({history.length})
            </button>
            <button
              onClick={() => setFilter('asl')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                filter === 'asl'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🤟 ASL ({history.filter(h => h.mode === 'ASL').length})
            </button>
            <button
              onClick={() => setFilter('voice')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                filter === 'voice'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              🎤 Voice ({history.filter(h => h.mode === 'Voice').length})
            </button>
          </div>
        )}

        {/* History List */}
        {filteredHistory.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">💬</div>
            <h3 className="text-2xl font-bold text-gray-700 mb-2">No Messages Yet</h3>
            <p className="text-gray-500">
              {filter === 'all'
                ? 'Start communicating to see your history here!'
                : `No ${filter} messages found. Try a different filter.`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHistory.map((item, index) => (
              <div
                key={index}
                className={`card ${
                  item.mode === 'ASL' ? 'bg-blue-50' : 'bg-green-50'
                } hover:shadow-lg transition-shadow`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="text-2xl">
                        {item.mode === 'ASL' ? '🤟' : '🎤'}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        item.mode === 'ASL'
                          ? 'bg-blue-200 text-blue-800'
                          : 'bg-green-200 text-green-800'
                      }`}>
                        {item.mode}
                      </span>
                      <div className="flex items-center text-gray-500 text-sm">
                        <User size={14} className="mr-1" />
                        {item.speaker}
                      </div>
                      <div className="flex items-center text-gray-500 text-sm">
                        <Clock size={14} className="mr-1" />
                        {formatTimestamp(item.timestamp)}
                      </div>
                    </div>
                    <p className="text-xl text-gray-800">{item.text}</p>
                  </div>
                  <button
                    onClick={() => speakText(item.text)}
                    className="ml-4 p-3 bg-white hover:bg-gray-100 rounded-lg transition-colors"
                    title="Speak this message"
                  >
                    <Volume2 size={20} className="text-purple-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Export Options */}
        {history.length > 0 && (
          <div className="card bg-purple-50 mt-6">
            <h3 className="text-xl font-semibold mb-3">Export Options</h3>
            <p className="text-gray-600 mb-4">
              Want to export your conversation history? Contact support for export features.
            </p>
            <div className="flex space-x-3">
              <button className="btn-secondary" disabled>
                Export as PDF
              </button>
              <button className="btn-secondary" disabled>
                Export as CSV
              </button>
              <button className="btn-secondary" disabled>
                Export as JSON
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-2">Coming soon!</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default HistoryPage;
