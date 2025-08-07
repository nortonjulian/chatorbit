import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import LoginForm from './components/LoginForm';
import Registration from './components/Registration';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';

export default function App() {
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
  }, []);

  return (
      
    <Routes>
      {!currentUser ? (
        <>
          <Route path="/" element={<LoginForm onLoginSuccess={setCurrentUser} />} />
          <Route path="/register" element={<Registration onRegisterSuccess={setCurrentUser} />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Navigate to="/" />} />
        </>
      ) : (
        <>
          <Route
            path="/"
            element={
              <div className="flex h-screen">
                <Sidebar currentUser={currentUser} setSelectedRoom={setSelectedRoom} />
                <main className="flex-1 p-6 overflow-y-auto">
                  <header className="mb-6 flex justify-between items-center">
                    <h1 className="text-4xl font-bold text-blue-600">Welcome to ChatOrbit</h1>
                    <button
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                      onClick={() => {
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                        setCurrentUser(null);
                      }}
                    >
                      Log Out
                    </button>
                  </header>
                  {selectedRoom ? (
                    <ChatView chatroom={selectedRoom} currentUserId={currentUser.id} currentUser={currentUser} />
                  ) : (
                    <div className="text-gray-500 text-center mt-20">
                      Select a text or chatroom to begin chatting
                    </div>
                  )}
                </main>
              </div>
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </>
      )}
    </Routes>
  );
}
