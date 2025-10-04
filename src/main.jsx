import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import AuthPage from './AuthPage.jsx'
import { AuthProvider, useAuth } from './AuthContext.jsx'
import './index.css'

function AppWrapper() {
  const { currentUser } = useAuth();
  
  return currentUser ? <App /> : <AuthPage />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <AppWrapper />
    </AuthProvider>
  </React.StrictMode>,
)