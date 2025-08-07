import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axiosClient from '../api/axiosClient'

function LoginForm({ onLoginSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await axiosClient.post('auth/login', { username, password })
      const { token, user } = res.data

      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))

      if (onLoginSuccess) onLoginSuccess(user)

      setUsername('')
      setPassword('')

      navigate('/')
    } catch (error) {
      console.log(error)
      setError('Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
  <div className="flex items-center justify-center min-h-screen bg-blue-700 px-4">
    <div className="w-full max-w-md bg-white p-6 rounded-lg shadow-md">
      {/* Logo and heading */}
      <div className="flex flex-col items-center mb-6">
        <img
          src="/ChatOrbit (possible).png"
          alt="ChatOrbit Logo"
          className="h-16 w-auto object-contain mb-2"
        />
        <h1 className="text-xl font-bold text-blue-700">ChatOrbit</h1>
        <p className="text-sm text-gray-500">Secure messaging from anywhere</p>
      </div>

      {/* Login form */}
      <form onSubmit={handleLogin} className="space-y-4">
        <input
          className="block w-full border border-gray-300 px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          className="block w-full border border-gray-300 px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          className="block w-full bg-blue-600 text-white py-2 rounded-md text-sm hover:bg-blue-700 transition"
          disabled={loading}
        >
          {loading ? 'Logging in...' : 'Log In'}
        </button>
      </form>

      {/* Forgot password */}
      <div className="mt-4 text-center">
        <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline">
          Forgot Password?
        </Link>
      </div>
    </div>
  </div>
   )
}

export default LoginForm
