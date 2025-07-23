import { useState } from 'react'

export default function CreateUserForm() {
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [message, setMessage] = useState('')
    const [password, setPassword] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()

        const res = await fetch('http://localhost:5001/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email }),
        })

        if (res.ok) {
            const data = await res.json()
            setMessage(`User ${data.username} created!`)
            setUsername('')
            setEmail('')
            setPassword('')
        } else {
            setMessage('Failed to create user.')
        }
    }

    return (
        <form onSubmit={handleSubmit} className='space-y-2'>
        <input 
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="border p-2 w-full"
            required
        />
        <input 
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border p-2 w-full"
            required
        />
        <input 
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-2 w-full"
            required
        />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
          Create User
        </button>
        {message && <p>{message}</p>}
        </form>
    )
}