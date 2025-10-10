import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

// Configure axios globally first
import './utils/axiosConfig';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import FirstVisitModal from './components/FirstVisitModal';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Home from './pages/Home';
import Landing from './pages/Landing';
import LittleStars from './pages/LittleStars';
import About from './pages/About';
import Courses from './pages/Courses';
import WebCourse from './pages/WebCourse';
import Contact from './pages/Contact';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';

// Context
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';

function AppContent() {
  const [showFirstVisitModal, setShowFirstVisitModal] = React.useState(false);
  const location = useLocation();

  React.useEffect(() => {
    // Check if this is the first visit and not on web-course page
    const hasVisited = localStorage.getItem('hasVisitedBefore');
    const isOnWebCourse = location.pathname === '/web-course';
    
    if (!hasVisited && !isOnWebCourse) {
      // Show modal after a short delay to ensure everything is loaded
      const timer = setTimeout(() => {
        setShowFirstVisitModal(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  // Conditional Routes Component
  const ConditionalRoutes: React.FC = () => {
    const { isAuthenticated } = useAuth();

    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/home" element={isAuthenticated ? <Dashboard /> : <Home />} />
        <Route path="/little-stars" element={<LittleStars />} />
        <Route path="/web-course" element={<WebCourse />} />
        {isAuthenticated ? (
          <>
            <Route path="/about" element={<About />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </>
        ) : (
          <>
            {/* For non-logged in users, show the actual pages */}
            <Route path="/about" element={<About />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/contact" element={<Contact />} />
            {/* Protected routes - always available but will redirect to login if not authenticated */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          </>
        )}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
      </Routes>
    );
  };

  return (
    <div className="w-full min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 w-full">
        <ConditionalRoutes />
      </main>
      <Footer />
      <Toaster position="top-right" richColors />

      {/* First Visit Modal */}
      <FirstVisitModal
        isOpen={showFirstVisitModal}
        onClose={() => setShowFirstVisitModal(false)}
      />
    </div>
  );
}

// Styles
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <AuthProvider>
            <Router>
              <AppContent />
            </Router>
          </AuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
