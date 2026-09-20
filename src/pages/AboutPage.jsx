import React, { useState, useEffect } from 'react';
import { ABOUT_TABS } from '../data/aboutOriginalData';
import '../styles/about.css';

export default function AboutPage({ initialTab = 'intro', onNavigate }) {
  const [activeTabId, setActiveTabId] = useState(initialTab);

  useEffect(() => {
    if (initialTab && ABOUT_TABS.some(t => t.id === initialTab)) {
      setActiveTabId(initialTab);
    }
  }, [initialTab]);

  const currentTab = ABOUT_TABS.find(t => t.id === activeTabId) || ABOUT_TABS[0];

  const handleTabClick = (tabId) => {
    if (tabId === 'contact') {
      window.open('https://band.us/n/a7a2b3X7k88dC', '_blank', 'noopener,noreferrer');
      return;
    }
    setActiveTabId(tabId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="about-page-container">
      {/* Top Sub-Navigation Bar (Matching Original Site Subnav Format) */}
      <nav className="about-subnav-bar" aria-label="About SBA Sub Navigation">
        <div className="container">
          <div className="about-subnav-inner">
            {ABOUT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`about-tab-btn ${activeTabId === tab.id ? 'active' : ''}`}
                onClick={() => handleTabClick(tab.id)}
              >
                {tab.tabName}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="container" style={{ maxWidth: '1100px', marginTop: '28px' }}>
        {/* Page Title with Original Site Style */}
        <div className="wrap_page_title">
          <strong>{currentTab.pageTitle}</strong>
        </div>

        {/* Content Card with Exact Original HTML */}
        <div className="about-content-card">
          <div
            className="about-page-wrapper"
            dangerouslySetInnerHTML={{ __html: currentTab.html }}
          />
        </div>
      </div>
    </div>
  );
}
