import { useState } from 'react'
import axiosClient from '../api/axiosClient'

export default function Registration({ onRegisterSuccess }) {
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [message, setMessage] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)

    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase())
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setMessage('')

        if (!validateEmail(email)) {
            setLoading(false)
            setMessage('Please enter a valid email address')
        }

        try {
            const res = await axiosClient.post('/auth/register', {
                username,
                email,
                password,
            })

            setMessage(`Welcome, ${res.data.user.username}! You can now log in.`)
            setUsername('')
            setEmail('')
            setPassword('')

            if (onRegisterSuccess) onRegisterSuccess(res.data.user)
        } catch (error) {
            console.log('Registration error:', error)
            if (error.response?.data.error) {
                setMessage(error.response.data.error)
            } else {
                setMessage('Registration failed. Try again')
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className='space-y-3 bg-white p4 rounded shadow'>
            <h2 className="text-xl font-semibold">Create an Account</h2>
        <input 
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="border p-2 w-full rounded"
            required
        />
        <input 
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border p-2 w-full rounded"
            required
        />
        <input 
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border p-2 w-full rounded"
            required
        />
        <button 
          type="submit" 
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded w-full hover:bg-blue-600 disabled:opacity-50"
          >
          {loading ? 'Registering...' : 'Register'}
        </button>
        {message && <p className="text-center mt-2 text-sm text-gray-700">{message}</p>}
        </form>
    )
}