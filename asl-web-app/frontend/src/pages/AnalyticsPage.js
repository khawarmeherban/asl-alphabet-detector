import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, MessageSquare, Mic, TrendingUp } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function AnalyticsPage() {
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatistics();
    const interval = setInterval(fetchStatistics, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchStatistics = async () => {
    try {
      const response = await axios.get(`${API_URL}/statistics`);
      setStatistics(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white text-2xl">Loading analytics...</div>
      </div>
    );
  }

  if (!statistics || statistics.total_messages === 0) {
    return (
      <div className="card text-center py-12">
        <Activity size={64} className="mx-auto mb-4 text-gray-400" />
        <h2 className="text-2xl font-bold text-gray-700 mb-2">No Data Yet</h2>
        <p className="text-gray-500">Start using the app to see your analytics!</p>
      </div>
    );
  }

  // Prepare data for charts
  const messageTypeData = [
    { name: 'ASL Messages', value: statistics.asl_messages, color: '#3b82f6' },
    { name: 'Voice Messages', value: statistics.voice_messages, color: '#10b981' }
  ];

  const letterFrequencyData = statistics.most_used_letters
    .slice(0, 10)
    .map(([letter, count]) => ({
      letter: letter.toUpperCase(),
      count: count
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
      icon: TrendingUp,
      label: 'Unique Letters',
      value: Object.keys(statistics.letter_frequency).length,
      color: 'from-orange-500 to-red-500'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-3xl font-bold mb-2 text-gray-800">Analytics Dashboard</h2>
        <p className="text-gray-600 mb-6">Track your ASL communication statistics</p>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div key={index} className="card bg-white">
              <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${stat.color} flex items-center justify-center mb-4`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div className="text-3xl font-bold text-gray-800 mb-1">{stat.value}</div>
              <div className="text-gray-600">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Message Type Distribution */}
          <div className="card bg-white">
            <h3 className="text-xl font-semibold mb-4">Message Type Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={messageTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {messageTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Most Used Letters */}
          <div className="card bg-white">
            <h3 className="text-xl font-semibold mb-4">Most Used Letters (Top 10)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={letterFrequencyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="letter" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#8b5cf6" name="Frequency" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Letter Frequency Table */}
        <div className="card bg-white mt-6">
          <h3 className="text-xl font-semibold mb-4">Complete Letter Frequency</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Object.entries(statistics.letter_frequency)
              .sort((a, b) => b[1] - a[1])
              .map(([letter, count]) => (
                <div key={letter} className="bg-purple-50 p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-purple-600">{letter.toUpperCase()}</div>
                  <div className="text-gray-600 text-sm">{count}x</div>
                </div>
              ))}
          </div>
        </div>

        {/* Insights */}
        <div className="card bg-gradient-to-r from-purple-50 to-blue-50 mt-6">
          <h3 className="text-xl font-semibold mb-4">Insights</h3>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="text-2xl">📊</div>
              <div>
                <p className="font-semibold">Communication Preference</p>
                <p className="text-gray-700">
                  You use {statistics.asl_messages > statistics.voice_messages ? 'ASL' : 'Voice'} mode more often 
                  ({Math.max(statistics.asl_messages, statistics.voice_messages)} messages vs {Math.min(statistics.asl_messages, statistics.voice_messages)} messages)
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="text-2xl">🔤</div>
              <div>
                <p className="font-semibold">Most Common Letter</p>
                <p className="text-gray-700">
                  The letter "{statistics.most_used_letters[0]?.[0]?.toUpperCase()}" is your most frequently signed letter 
                  (used {statistics.most_used_letters[0]?.[1]} times)
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="text-2xl">✨</div>
              <div>
                <p className="font-semibold">Alphabet Coverage</p>
                <p className="text-gray-700">
                  You've used {Object.keys(statistics.letter_frequency).length} out of 26 letters 
                  ({((Object.keys(statistics.letter_frequency).length / 26) * 100).toFixed(0)}% of the alphabet)
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
