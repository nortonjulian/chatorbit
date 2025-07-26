// import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
// import './App.css'

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import React, { useState, useEffect } from 'react'
import UsersList from "./components/UsersList";
import CreateUserForm from './components/CreateUserForm';
import ChatroomList from './components/ChatroomList';
import ChatView from './components/ChatView';
import LoginForm from './components/LoginForm';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';

export default function App() {
  const {selectedRoom, setSelectedRoom} = useState(null)
  const {currentUser, setCurrentUser} = useState(null)

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (savedUser) setCurrentUser(JSON.parse(savedUser))
  })

  // const handleLoginSuccess = (user) => {
  //   setCurrentUser(user)
  // }

  if (!currentUser) {
    return (
      <Router>
        <Routes>
          <Route path="/" element={<LoginForm onLoginSuccess={setCurrentUser} />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </Router>
    )
  }

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <LoginForm onLoginSuccess={setCurrentUser} />
      </div>
    )
  }

  return (
    <div className="flex h-screen">
  {/* Sidebar */}
  <aside className="w-1/4 bg-white p-4 border-r space-y-6">
    <div>
      <h2 className="text-xl font-semibold mb-2">Users</h2>
      <UsersList />
    </div>
    <div>
      <h2 className="text-xl font-semibold mb-2">Create User</h2>
      <CreateUserForm />
    </div>
    <div>
      <h2 className="text-xl font-semibold mt-6 mb-2">Chatrooms</h2>
      <ChatroomList onSelect={setSelectedRoom} />
    </div>
  </aside>

  {/* Main Content */}
  <main className="flex-1 p-6 overflow-y-auto">
    <header className="mb-6">
      <h1 className="text-4xl font-bold text-blue-600">Welcome to ChatOrbit</h1>
      <button
         className="bg--red-500 text-white px-3 py-1 rounded hover:bg-red-600"
         onClick={() => {
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            setCurrentUser(null)
         }}
      >
        Log Out
      </button>
    </header>

    {selectedRoom ? (
      <ChatView chatroom={selectedRoom} currentUserId={currentUser.id}/>
    ) : (
      <div className="text-gray-500 text-center mt-20">
        Select a chatroom to begin chatting
      </div>
    )}
  </main>
</div>
  )
}


