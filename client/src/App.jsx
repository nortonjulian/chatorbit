// import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
// import './App.css'

import React, { useState } from 'react'
import UsersList from "./components/UsersList";
import CreateUserForm from './components/CreateUserForm';
import ChatroomList from './components/ChatroomList';
import ChatView from './components/ChatView';

export default function App() {
  const {selectedRoom, setSelectedRoom} = useState(null)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <header>
        <h1 className="text-4xl font-bold text-blue-600">Welcome to ChatOrbit</h1>
      </header>

      <div>

        <div className="w-1/3 p-4 border-r bg-white">
        <h2 className="text-xl font-semibold mb-2">Users</h2>
        <UsersList />
        <CreateUserForm />

        <h2 className="text-xl font-semibold mt-6 mb-2">Chatrooms</h2>
        <ChatroomList onSelect={setSelectedRoom} />
        </div>

        <div className="w-2/3 p-4">
          {selectedRoom ? (
            <ChatView chatroom={selectedRoom} />
          ) : (
            <div className="text-gray-500 text-center mt-20">
              Select a chatroom to begin chatting
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


