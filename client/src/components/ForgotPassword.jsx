import { useState } from 'react'
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [previewUrl, setPreviewUrl] = useState('');
    const [loading, setLoading] = useState(false);

    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase())
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setPreviewUrl('')

        if (!validateEmail(email)) {
            setLoading(false);
            setMessage('Please enter a valid email address')
        }

        try {
            const res = await axiosClient.post('/auth/forgot-password', { email });
            setMessage(res.data.message || 'Check your email for reset instructions.')
            if (res.data.previewUrl) {
                setPreviewUrl(res.data.previewUrl)
            }
        } catch (error) {
            console.log(error)
            setMessage('Error: Unable to process request')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
            <h2 className="text-xl font-semibold mb-4">Forgot Password</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                   type="email"
                   className="w-full border p-2 rounded"
                   placeholder="Enter your email"
                   value={email}
                   onChange={(e) => setEmail(e.target.value)}
                   required
                />
                <button
                   type="submit"
                   className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                   disabled={loading}
                >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
            </form>
            {message && <p className="mt-4 text-center text-gray-600">{message}</p>}
                {previewUrl && (
                    <p className="mt-2 text-center text-sm text-blue-500">
                        <a href={previewUrl} target="_blank" rel="noopener noreferrer">Preview Email (Dev)</a>
                    </p>
                )}

                <div className="mt-6 text-center">
                    <Link to="/" className="text-blue-600 hover:underline">Back to Login</Link>
                </div>
        </div>
    )
}