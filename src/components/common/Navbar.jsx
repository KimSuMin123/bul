import React, { useState } from 'react';
import { BookOpen, Shield, User, LogOut, LogIn, UserPlus, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Navbar({ currentView, onNavigate }) {
  const { currentUser, logout, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
    onNavigate('home');
  };

  const handleNavClick = (view) => {
    onNavigate(view);
    setMobileMenuOpen(false);
  };

  return (
    <header 
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid var(--color-border)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
      }}
    >
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '68px' }}>
        
        {/* Brand Logo */}
        <div 
          onClick={() => handleNavClick('home')} 
          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <img 
            src="/images/logo.png" 
            alt="사단법인 세화불학원" 
            style={{ height: '40px', width: 'auto', objectFit: 'contain' }} 
          />
        </div>

        {/* Desktop Navigation Menus */}
        <nav className="desktop-nav-menu" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            className={`btn ${currentView === 'home' ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => handleNavClick('home')}
          >
            <BookOpen size={16} color="var(--color-sage)" />
            <span>강의 과정</span>
          </button>

          <button 
            className={`btn ${currentView === 'dashboard' ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => handleNavClick('dashboard')}
          >
            <User size={16} color="var(--color-sage)" />
            <span>내 강의실</span>
          </button>

          {isAdmin && (
            <button 
              className={`btn ${currentView === 'admin' ? 'btn-primary' : 'btn-ghost'}`}
              style={currentView === 'admin' ? {} : { color: 'var(--color-sage)', fontWeight: 600 }}
              onClick={() => handleNavClick('admin')}
            >
              <Shield size={16} />
              <span>관리자 CMS</span>
            </button>
          )}
        </nav>

        {/* Desktop Right Side: Account Controls */}
        <div className="desktop-auth-capsule" style={{ display: 'flex', alignItems: 'center', gap: '10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {/* User Profile Capsule */}
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  padding: '6px 12px',
                  backgroundColor: 'var(--color-surface-warm)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--color-charcoal)' }}>{currentUser.name}</span>
                <span className={`badge ${currentUser.role === 'admin' ? 'badge-coral' : 'badge-sage'}`} style={{ whiteSpace: 'nowrap' }}>
                  {currentUser.role === 'admin' ? '관리자' : '수강생'}
                </span>
              </div>

              <button className="btn btn-ghost btn-sm" onClick={handleLogout} title="로그아웃" style={{ whiteSpace: 'nowrap' }}>
                <LogOut size={16} />
                <span>로그아웃</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => handleNavClick('login')}>
                <LogIn size={15} />
                <span>로그인</span>
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => handleNavClick('register')}>
                <UserPlus size={15} />
                <span>회원가입</span>
              </button>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <button 
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="메뉴 토글"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

      </div>

      {/* Mobile Navigation Drawer Backdrop & Drawer */}
      {mobileMenuOpen && (
        <>
          <div 
            className="mobile-nav-backdrop" 
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="mobile-nav-drawer">
            {/* Drawer Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid var(--color-border)', marginBottom: '16px' }}>
              <div>
                <img 
                  src="/images/logo.png" 
                  alt="세화불학원" 
                  style={{ height: '30px', width: 'auto', objectFit: 'contain', marginBottom: '4px' }} 
                />
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                  온라인 원격 배움터
                </div>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'var(--color-surface-warm)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Current User Status Capsule in Drawer */}
            {currentUser ? (
              <div style={{ backgroundColor: 'var(--color-surface-warm)', padding: '14px', borderRadius: '8px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--color-charcoal)' }}>{currentUser.name} 님</span>
                  <span className={`badge ${currentUser.role === 'admin' ? 'badge-coral' : 'badge-sage'}`}>
                    {currentUser.role === 'admin' ? '최고관리자' : '수강생'}
                  </span>
                </div>
                {currentUser.memberNo && (
                  <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted)' }}>
                    학번: {currentUser.memberNo}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ backgroundColor: 'var(--color-surface-warm)', padding: '14px', borderRadius: '8px', marginBottom: '18px', textAlign: 'center' }}>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-charcoal)', marginBottom: '10px' }}>
                  로그인 후 강의를 시청하세요
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleNavClick('login')}>
                    <LogIn size={14} />
                    <span>로그인</span>
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => handleNavClick('register')}>
                    <UserPlus size={14} />
                    <span>회원가입</span>
                  </button>
                </div>
              </div>
            )}

            {/* Mobile Navigation Links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              <button 
                className={`btn ${currentView === 'home' ? 'btn-secondary' : 'btn-ghost'}`}
                style={{ justifyContent: 'flex-start', padding: '12px 14px', fontSize: '15px' }}
                onClick={() => handleNavClick('home')}
              >
                <BookOpen size={18} color="var(--color-sage)" />
                <span>강의 과정 둘러보기</span>
              </button>

              <button 
                className={`btn ${currentView === 'dashboard' ? 'btn-secondary' : 'btn-ghost'}`}
                style={{ justifyContent: 'flex-start', padding: '12px 14px', fontSize: '15px' }}
                onClick={() => handleNavClick('dashboard')}
              >
                <User size={18} color="var(--color-sage)" />
                <span>내 강의실 바로가기</span>
              </button>

              {isAdmin && (
                <button 
                  className={`btn ${currentView === 'admin' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ justifyContent: 'flex-start', padding: '12px 14px', fontSize: '15px', color: currentView === 'admin' ? '#fff' : 'var(--color-sage)', fontWeight: 600 }}
                  onClick={() => handleNavClick('admin')}
                >
                  <Shield size={18} />
                  <span>관리자 학사 CMS</span>
                </button>
              )}
            </div>

            {/* Bottom Logout for Logged-in User */}
            {currentUser && (
              <div style={{ paddingTop: '16px', borderTop: '1px solid var(--color-border)', marginTop: 'auto' }}>
                <button 
                  className="btn btn-ghost"
                  style={{ width: '100%', justifyContent: 'center', color: '#E53E3E', fontSize: '14px', padding: '10px' }}
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  <span>로그아웃</span>
                </button>
              </div>
            )}

          </div>
        </>
      )}
    </header>
  );
}
