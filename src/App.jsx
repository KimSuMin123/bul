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

export default function App() {
  const { currentUser, isAdmin } = useAuth();

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
      alert('관리자 계정(admin)만 접근할 수 있는 페이지입니다.');
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

  return (
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
  );
}
