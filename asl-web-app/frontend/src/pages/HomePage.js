import React from 'react';
import { Link } from 'react-router-dom';
import { Camera, MessageSquare, BarChart3, Zap, Globe, Brain } from 'lucide-react';

function HomePage() {
  const features = [
    {
      icon: Camera,
      title: 'Live ASL Detection',
      description: 'Real-time hand sign recognition using your webcam',
      color: 'from-blue-500 to-cyan-500',
      link: '/detection'
    },
    {
      icon: MessageSquare,
      title: 'Bidirectional Communication',
      description: 'ASL to text and voice to text in one interface',
      color: 'from-purple-500 to-pink-500',
      link: '/bidirectional'
    },
    {
      icon: BarChart3,
      title: 'Analytics Dashboard',
      description: 'Track your usage statistics and progress',
      color: 'from-green-500 to-teal-500',
      link: '/analytics'
    }
  ];

  const stats = [
    { label: 'Accuracy', value: '94.46%', icon: Zap },
    { label: 'Languages', value: '8+', icon: Globe },
    { label: 'ML Model', value: 'Random Forest', icon: Brain }
  ];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-6 py-12">
        <h1 className="text-6xl font-bold text-white mb-4">
          Welcome to ASL Communication System
        </h1>
        <p className="text-2xl text-purple-100 max-w-3xl mx-auto">
          Breaking communication barriers with AI-powered American Sign Language recognition
        </p>
        <div className="flex justify-center space-x-4 pt-6">
          <Link to="/detection" className="btn-primary text-lg">
            Get Started
          </Link>
          <Link to="/bidirectional" className="btn-secondary text-lg">
            Try Communication
          </Link>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="card text-center">
            <stat.icon className="w-12 h-12 mx-auto mb-4 text-purple-600" />
            <div className="text-4xl font-bold text-purple-600 mb-2">{stat.value}</div>
            <div className="text-gray-600 text-lg">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Features Section */}
      <div>
        <h2 className="text-4xl font-bold text-white text-center mb-12">
          Powerful Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Link key={index} to={feature.link}>
              <div className="card hover:scale-105 transform transition-all duration-300 cursor-pointer h-full">
                <div className={`w-16 h-16 rounded-full bg-gradient-to-r ${feature.color} flex items-center justify-center mb-4`}>
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-gray-800">{feature.title}</h3>
                <p className="text-gray-600 text-lg">{feature.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Additional Features */}
      <div className="card">
        <h2 className="text-3xl font-bold mb-6 text-gray-800">What's Included</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start space-x-3">
            <div className="text-green-500 text-2xl">✓</div>
            <div>
              <h3 className="font-semibold text-lg">Real-time Detection</h3>
              <p className="text-gray-600">Instant ASL alphabet recognition</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="text-green-500 text-2xl">✓</div>
            <div>
              <h3 className="font-semibold text-lg">Word Prediction</h3>
              <p className="text-gray-600">Smart auto-complete suggestions</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="text-green-500 text-2xl">✓</div>
            <div>
              <h3 className="font-semibold text-lg">Text-to-Speech</h3>
              <p className="text-gray-600">Hear your translations</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="text-green-500 text-2xl">✓</div>
            <div>
              <h3 className="font-semibold text-lg">Conversation History</h3>
              <p className="text-gray-600">Track all your interactions</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="text-green-500 text-2xl">✓</div>
            <div>
              <h3 className="font-semibold text-lg">Multi-language</h3>
              <p className="text-gray-600">Support for 8+ languages</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="text-green-500 text-2xl">✓</div>
            <div>
              <h3 className="font-semibold text-lg">Analytics</h3>
              <p className="text-gray-600">Detailed usage statistics</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-white text-sm py-6">
        <p>Built with React.js, Flask, MediaPipe & Machine Learning</p>
        <p className="mt-2">© 2026 ASL Communication System</p>
      </div>
    </div>
  );
}

export default HomePage;
