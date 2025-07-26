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
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await axiosClient.post('auth/login', { username, password });
            const { token, user } = res.data;

            localStorage.setItem('token', token)
            localStorage.setItem('user', JSON.stringify(user))

            if (onLoginSuccess)onLoginSuccess(user)

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
        <div className="bg-white p-6 rounded shadow-md max-w-sm mx-auto">
            <h2 className="text-xl font-semibold mb-4">Log In</h2>
            <form onSubmit={handleLogin} className="space-y-4">
                <input
                   className="w-full border p-2 rounded"
                   placeholder="Username"
                   value={username}
                   onChange={(e) => setUsername(e.target.value)}
                   required
                />
                <input
                   className="w-full border p-2 rounded"
                   type="password"
                   placeholder="Password"
                   value={password}
                   onChange={(e) => setUsername(e.target.value)}
                   required
                />
                {error && <p className="text-red-500" text-sm>{error}</p>}
                <button
                   type="submit"
                   className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                   disabled={loading}
                >
                    {loading ? 'Logging in...' : 'Log In'}
                </button>
            </form>

             {/*Forgot password link */}
             <div className="mt-4 text-center">
                <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline">
                    Forgot Password?
                </Link>
            </div>
        </div>
    )
}

export default LoginForm