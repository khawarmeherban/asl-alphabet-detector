import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Link, Route, Routes, useLocation } from 'react-router-dom';
import {
  Activity,
  Brain,
  Camera,
  Hand,
  History,
  Home,
  MessageSquare,
  Music2
} from 'lucide-react';
import { ThemeProvider, ThemeToggle } from './context/ThemeContext';

const HomePage = lazy(() => import('./pages/HomePage'));
const LiveDetection = lazy(() => import('./pages/LiveDetection'));
const BidirectionalPage = lazy(() => import('./pages/BidirectionalPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const GestureControl = lazy(() => import('./pages/GestureControl'));
const VirtualPianoPage = lazy(() => import('./pages/VirtualPianoPage'));
const LearningMode = lazy(() => import('./pages/LearningMode'));

function LoadingFallback() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="rounded-[2rem] border border-white/10 bg-[#07131c]/92 px-8 py-10 text-center shadow-[0_24px_80px_rgba(2,8,12,0.42)]">
        <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-[#1fe0b1] border-t-transparent" />
        <h2 className="mt-5 text-2xl font-black text-white">Loading AlphaHand</h2>
        <p className="mt-2 text-sm text-slate-400">Preparing the competition workspace</p>
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
    console.error('Application boundary error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(145deg,#071019,#091821_58%,#061018)] p-6">
          <div className="max-w-lg rounded-[2rem] border border-rose-400/20 bg-[#101923] p-8 text-center shadow-[0_24px_80px_rgba(2,8,12,0.42)]">
            <h1 className="text-3xl font-black text-white">The workspace hit an unexpected error</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {this.state.error?.message || 'A rendering failure occurred.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 rounded-2xl bg-[#1fe0b1] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#52e8c1]"
            >
              Reload Application
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
    { path: '/learning', icon: Brain, label: 'Learning Mode' },
    { path: '/bidirectional', icon: MessageSquare, label: 'Communication' },
    { path: '/gesture-control', icon: Hand, label: 'Gesture Control' },
    { path: '/music', icon: Music2, label: 'Virtual Music' },
    { path: '/analytics', icon: Activity, label: 'Analytics' },
    { path: '/history', icon: History, label: 'History' }
  ];

  return (
    <nav className="sticky top-0 z-40 border-b border-white/10 bg-[#07131c]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#1fe0b1]/25 bg-[#1fe0b1]/10">
              <Hand size={20} className="text-[#b9fff1]" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">ASL Smart Communication Platform</p>
              <h1 className="text-xl font-black tracking-tight text-white">AlphaHand</h1>
            </div>
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-wrap gap-2">
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'bg-[#1fe0b1] text-slate-950 shadow-[0_12px_30px_rgba(31,224,177,0.28)]'
                    : 'border border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
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
            <main className="mx-auto max-w-7xl px-4 py-6" role="main">
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/detection" element={<LiveDetection />} />
                  <Route path="/learning" element={<LearningMode />} />
                  <Route path="/bidirectional" element={<BidirectionalPage />} />
                  <Route path="/gesture-control" element={<GestureControl />} />
                  <Route path="/music" element={<VirtualPianoPage />} />
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
