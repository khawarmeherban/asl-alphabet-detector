import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Camera, Home, MessageSquare, BarChart3, History, Hand } from 'lucide-react';
import { ThemeProvider, ThemeToggle } from './context/ThemeContext';

const HomePage = lazy(() => import('./pages/HomePage'));
const LiveDetection = lazy(() => import('./pages/LiveDetection'));
const BidirectionalPage = lazy(() => import('./pages/BidirectionalPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const GestureControl = lazy(() => import('./pages/GestureControl'));

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(0,255,136,0.18),_transparent_28%),linear-gradient(145deg,#020617,#08130f_55%,#03120c)]">
      <div className="space-y-6 text-center">
        <div className="relative">
          <div className="mx-auto h-24 w-24 animate-spin rounded-full border-8 border-[#00ff88] border-t-transparent" />
          <div className="absolute inset-0 flex items-center justify-center text-4xl" role="img" aria-label="hand sign">
            🤟
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Loading AlphaHand...</h2>
          <p className="text-[#b8ffda]">Preparing the live communication workspace</p>
        </div>
        <div className="mx-auto mt-8 max-w-md space-y-3">
          <div className="h-4 animate-pulse rounded bg-white/10" />
          <div className="mx-auto h-4 w-3/4 animate-pulse rounded bg-white/10" />
          <div className="mx-auto h-4 w-1/2 animate-pulse rounded bg-white/10" />
        </div>
      </div>
    </div>
  );
}

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
        <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(145deg,#1f1111,#120606)]">
          <div className="card max-w-md text-center">
            <h1 className="mb-4 text-3xl font-bold text-red-600">Something went wrong</h1>
            <p className="mb-6 text-gray-700">{this.state.error?.message || 'An unexpected error occurred'}</p>
            <button onClick={() => window.location.reload()} className="btn-primary">
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
    <nav className="border-b border-[#00ff88]/15 bg-slate-950/85 p-4 text-white shadow-lg backdrop-blur-xl" role="navigation" aria-label="Main navigation">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="text-3xl" role="img" aria-label="ASL emoji">🤟</div>
          <h1 className="bg-gradient-to-r from-white via-[#b8ffda] to-[#00ff88] bg-clip-text text-2xl font-bold text-transparent">
            AlphaHand
          </h1>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex space-x-1">
            {navItems.map(({ path, icon: Icon, label }) => (
              <Link
                key={path}
                to={path}
                className={`flex items-center space-x-2 rounded-lg px-4 py-2 transition-all duration-300 focus-visible ${
                  location.pathname === path
                    ? 'bg-[#00ff88] text-slate-950 shadow-lg'
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

          <div className="ml-2">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <Router>
          <div className="min-h-screen">
            <Navigation />
            <main className="container mx-auto p-6" role="main">
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/detection" element={<LiveDetection />} />
                  <Route path="/gesture-control" element={<GestureControl />} />
                  <Route path="/bidirectional" element={<BidirectionalPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/history" element={<HistoryPage />} />
                </Routes>
              </Suspense>
            </main>
          </div>
        </Router>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
