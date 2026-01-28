import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LiveDetection from './pages/LiveDetection';
import BidirectionalPage from './pages/BidirectionalPage';
import AnalyticsPage from './pages/AnalyticsPage';
import HistoryPage from './pages/HistoryPage';
import GestureControl from './pages/GestureControl';
import { Camera, Home, MessageSquare, BarChart3, History, Hand } from 'lucide-react';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-500 to-pink-500">
          <div className="card max-w-md text-center">
            <h1 className="text-3xl font-bold text-red-600 mb-4">Something went wrong</h1>
            <p className="text-gray-700 mb-6">{this.state.error?.message || 'An unexpected error occurred'}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="btn-primary"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function Navigation() {
  const location = useLocation();
  
  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/detection', icon: Camera, label: 'Live Detection' },
    { path: '/gesture-control', icon: Hand, label: 'Gesture Control' },
    { path: '/bidirectional', icon: MessageSquare, label: 'Communication' },
    { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/history', icon: History, label: 'History' }
  ];

  return (
    <nav className="glass-effect text-white p-4 shadow-lg" role="navigation" aria-label="Main navigation">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="text-3xl" role="img" aria-label="ASL emoji">🤟</div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
            ASL Communication
          </h1>
        </div>
        
        <div className="flex space-x-1">
          {navItems.map(({ path, icon: Icon, label }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-300 focus-visible ${
                location.pathname === path
                  ? 'bg-white bg-opacity-20 shadow-lg'
                  : 'hover:bg-white hover:bg-opacity-10'
              }`}
              aria-current={location.pathname === path ? 'page' : undefined}
              aria-label={label}
            >
              <Icon size={20} aria-hidden="true" />
              <span className="hidden md:inline">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen">
          <Navigation />
          <main className="container mx-auto p-6" role="main">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/detection" element={<LiveDetection />} />
              <Route path="/gesture-control" element={<GestureControl />} />
              <Route path="/bidirectional" element={<BidirectionalPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/history" element={<HistoryPage />} />
            </Routes>
          </main>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
