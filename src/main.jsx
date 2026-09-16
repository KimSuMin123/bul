import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import CSS Design System & Components
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/player.css';
import './styles/certificate.css';
import './styles/responsive.css';

import { AuthProvider } from './context/AuthContext';
import { CourseProvider } from './context/CourseContext';
import { ModalAlertProvider } from './context/ModalAlertContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ModalAlertProvider>
      <AuthProvider>
        <CourseProvider>
          <App />
        </CourseProvider>
      </AuthProvider>
    </ModalAlertProvider>
  </React.StrictMode>
);
