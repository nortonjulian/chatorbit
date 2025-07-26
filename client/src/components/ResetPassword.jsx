import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import axiosClient from '../api/axiosClient';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true)
        setMessage('')

        try {
            const res = await axiosClient.post('/auth/reset-password', {
                token,
                newPassword: password,
            })
            setMessage(res.data.message || 'Password has been reset successfully.')
        } catch (error) {
            console.log(error)
            setMessage('Error: Unable to reset password')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
            <h2 className="text-xl font-semibold mb-4">Resett Password</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                   type="password"
                   className="w-full border p-2 rounded"
                   placeholder="Enter your new password"
                   value={password}
                   onChange={(e) => setPassword(e.target.value)}
                   required
                />
                <button
                   type="submit"
                   className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                   disabled={loading}
                >
                    {loading ? 'Resetting...' : 'Reset Password'}
                </button>
            </form>
            {message && <p className="mt-4 text-center text-gray-600">{message}</p>}
        </div>
    )
}