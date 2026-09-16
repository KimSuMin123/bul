import React, { useState, useEffect } from 'react';
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import ConflictModal from './components/common/ConflictModal';

import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import CourseDetailPage from './pages/CourseDetailPage';
import WatchPage from './pages/WatchPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CertificateVerifyPage from './pages/CertificateVerifyPage';
import AdminDashboardPage from './pages/AdminDashboardPage';

import { useAuth } from './context/AuthContext';
import { useModalAlert } from './context/ModalAlertContext';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

// Global Error Boundary to prevent White Screen on any runtime error
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Application Error Caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '80px 20px', textAlign: 'center', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444', marginBottom: '16px' }}>
            <AlertCircle size={32} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', marginBottom: '10px', color: 'var(--color-charcoal)' }}>
            일시적인 화면 오류가 발생했습니다
          </h2>
          <p style={{ color: '#64748B', maxWidth: '460px', lineHeight: '1.6', marginBottom: '24px', fontSize: '14px' }}>
            {this.state.error?.message || '페이지를 불러오는 중 문제가 발생했습니다. 새로고침을 진행해 주세요.'}
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="btn btn-primary" 
              onClick={() => { this.setState({ hasError: false }); window.location.hash = 'home'; window.location.reload(); }}
            >
              <RefreshCw size={16} />
              <span>새로고침 및 첫 화면으로</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const { currentUser, isAdmin, loading } = useAuth();
  const { showAlert } = useModalAlert();

  // Navigation state: 'home' | 'dashboard' | 'courseDetail' | 'watch' | 'login' | 'register' | 'verify' | 'admin'
  const [currentView, setCurrentView] = useState('home');
  const [selectedCourseId, setSelectedCourseId] = useState('course-ritual-8-11');
  const [selectedLectureId, setSelectedLectureId] = useState('lec-ritual-08-1');

  // Handle URL hash changes for direct deep linking and back/forward buttons
  useEffect(() => {
    const parseHash = () => {
      const hash = window.location.hash.replace(/^#/, '');
      if (!hash) return;

      const [route, queryString] = hash.split('?');
      const params = new URLSearchParams(queryString || '');

      if (route === 'watch') {
        const id = params.get('id') || 'lec-ritual-08-1';
        setSelectedLectureId(id);
        setCurrentView('watch');
      } else if (route === 'courseDetail') {
        const id = params.get('id') || 'course-ritual-8-11';
        setSelectedCourseId(id);
        setCurrentView('courseDetail');
      } else if (['home', 'dashboard', 'login', 'register', 'verify', 'admin'].includes(route)) {
        setCurrentView(route);
      }
    };

    parseHash();
    window.addEventListener('hashchange', parseHash);
    return () => window.removeEventListener('hashchange', parseHash);
  }, []);

  // Scroll to top on view change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentView, selectedLectureId, selectedCourseId]);

  const handleNavigate = (view) => {
    if (view === 'admin' && !isAdmin) {
      showAlert('관리자 계정(admin)만 접근할 수 있는 페이지입니다.', { type: 'warning', title: '접근 권한 제한' });
      return;
    }
    window.location.hash = view;
    setCurrentView(view);
  };

  const handleSelectCourse = (courseId) => {
    setSelectedCourseId(courseId);
    window.location.hash = `courseDetail?id=${courseId}`;
    setCurrentView('courseDetail');
  };

  const handleStartLecture = (lectureId) => {
    setSelectedLectureId(lectureId);
    window.location.hash = `watch?id=${lectureId}`;
    setCurrentView('watch');
  };

  // Initial Auth Loading Screen
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <img 
          src="/images/logo.png" 
          alt="세화붓다아카데미" 
          style={{ height: '48px', width: 'auto', marginBottom: '20px', objectFit: 'contain' }} 
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-sage)', fontSize: '15px', fontWeight: 600 }}>
          <Loader2 size={20} className="animate-spin" />
          <span>세화붓다아카데미 보안 세션을 연결하고 있습니다...</span>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="app-wrapper">
        <Navbar currentView={currentView} onNavigate={handleNavigate} />

        <main className="main-content">
          {currentView === 'home' && (
            <HomePage 
              onNavigate={handleNavigate} 
              onSelectCourse={handleSelectCourse} 
            />
          )}

          {currentView === 'dashboard' && (
            <DashboardPage 
              onNavigate={handleNavigate} 
              onStartLecture={handleStartLecture} 
            />
          )}

          {currentView === 'courseDetail' && (
            <CourseDetailPage 
              courseId={selectedCourseId} 
              onNavigate={handleNavigate} 
              onStartLecture={handleStartLecture} 
            />
          )}

          {currentView === 'watch' && (
            <WatchPage 
              lectureId={selectedLectureId} 
              onNavigate={handleNavigate} 
              onSelectLecture={handleStartLecture} 
            />
          )}

          {currentView === 'login' && (
            <LoginPage onNavigate={handleNavigate} />
          )}

          {currentView === 'register' && (
            <RegisterPage onNavigate={handleNavigate} />
          )}

          {currentView === 'verify' && (
            <CertificateVerifyPage onNavigate={handleNavigate} />
          )}

          {currentView === 'admin' && (
            <AdminDashboardPage />
          )}
        </main>

        <Footer />

        {/* Concurrent Login Session Conflict Modal */}
        <ConflictModal />
      </div>
    </ErrorBoundary>
  );
}
