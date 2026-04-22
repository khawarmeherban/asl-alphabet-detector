import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Activity, MessageSquare, Mic, TrendingUp, Trophy } from 'lucide-react';
import { fetchAnalyticsSummary } from '../services/firebaseSync';

function loadLocalLetterHistory() {
  try {
    const raw = localStorage.getItem('alphahand-letter-history');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function AnalyticsPage() {
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const summary = await fetchAnalyticsSummary(loadLocalLetterHistory());
      setStatistics(summary);
      setLoading(false);
    };

    load();
    const interval = window.setInterval(load, 10000);
    return () => window.clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-2xl text-white">Loading Firebase analytics...</div>
      </div>
    );
  }

  if (!statistics || statistics.total_messages === 0) {
    return (
      <div className="card py-12 text-center">
        <Activity size={64} className="mx-auto mb-4 text-gray-400" />
        <h2 className="mb-2 text-2xl font-bold text-gray-700">No Data Yet</h2>
        <p className="text-gray-500">Start using the app to populate Firebase analytics.</p>
      </div>
    );
  }

  const messageTypeData = [
    { name: 'ASL Messages', value: statistics.asl_messages, color: '#3b82f6' },
    { name: 'Voice Messages', value: statistics.voice_messages, color: '#10b981' }
  ];

  const letterFrequencyData = statistics.most_used_letters.map(([letter, count]) => ({
    letter: letter.toUpperCase(),
    count
  }));

  const stats = [
    {
      icon: MessageSquare,
      label: 'Total Messages',
      value: statistics.total_messages,
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Activity,
      label: 'ASL Messages',
      value: statistics.asl_messages,
      color: 'from-purple-500 to-pink-500'
    },
    {
      icon: Mic,
      label: 'Voice Messages',
      value: statistics.voice_messages,
      color: 'from-green-500 to-teal-500'
    },
    {
      icon: Trophy,
      label: 'Best Practice Score',
      value: statistics.best_practice_score,
      color: 'from-orange-500 to-red-500'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="mb-2 text-3xl font-bold text-gray-800">Analytics Dashboard</h2>
        <p className="mb-6 text-gray-600">Firebase-backed communication and practice insights</p>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="card bg-white">
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div className="mb-1 text-3xl font-bold text-gray-800">{stat.value}</div>
              <div className="text-gray-600">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card bg-white">
            <h3 className="mb-4 text-xl font-semibold">Message Type Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={messageTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  dataKey="value"
                >
                  {messageTypeData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="card bg-white">
            <h3 className="mb-4 text-xl font-semibold">Most Used Letters</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={letterFrequencyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="letter" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#00c16a" name="Frequency" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card mt-6 bg-white">
          <h3 className="mb-4 text-xl font-semibold">Complete Letter Frequency</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            {Object.entries(statistics.letter_frequency)
              .sort((left, right) => right[1] - left[1])
              .map(([letter, count]) => (
                <div key={letter} className="rounded-lg bg-emerald-50 p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-600">{letter.toUpperCase()}</div>
                  <div className="text-sm text-gray-600">{count}x</div>
                </div>
              ))}
          </div>
        </div>

        <div className="card mt-6 bg-gradient-to-r from-emerald-50 to-cyan-50">
          <h3 className="mb-4 text-xl font-semibold">Insights</h3>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="text-2xl">📊</div>
              <div>
                <p className="font-semibold">Communication Preference</p>
                <p className="text-gray-700">
                  You currently use {statistics.asl_messages >= statistics.voice_messages ? 'ASL' : 'Voice'} more often.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="text-2xl">🔤</div>
              <div>
                <p className="font-semibold">Most Common Letter</p>
                <p className="text-gray-700">
                  The letter "{statistics.most_used_letters[0]?.[0]?.toUpperCase()}" appears most often.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="text-2xl">✨</div>
              <div>
                <p className="font-semibold">Practice Progress</p>
                <p className="text-gray-700">
                  Best score: {statistics.best_practice_score}. Best streak: {statistics.best_streak}. Synced sessions: {statistics.practice_sessions}.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <TrendingUp className="mt-1 h-6 w-6 text-emerald-600" />
              <div>
                <p className="font-semibold">Alphabet Coverage</p>
                <p className="text-gray-700">
                  You have used {Object.keys(statistics.letter_frequency).length} unique letters.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsPage;
