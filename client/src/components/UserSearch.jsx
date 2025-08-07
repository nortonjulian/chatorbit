import { useState } from 'react'
import axiosClient from '../api/axiosClient';

const UserSearch = ({ currentUser, onNavigateToChatRoom }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async () => {
        if (!query.trim()) {
            setResults([])
            return;
        }
        
        setLoading(true);
        setError('');
        try {
            const res = await axiosClient.get(`/users/search?query=${encodeURIComponent(query)}`);

            const filtered = res.data.filter((user) => user.id !== currentUser.id);
            setResults(filtered)
        } catch (error) {
            console.log('Search error:', error)
            setError('Unable to fetch users. Please try again')
        } finally {
            setLoading(false)
        }
    }

    const handleSendMessage = async (userId) => {
        try {
            const res = await axiosClient.post('/chatrooms/direct', {
                userId1: currentUser.id,
                userId2: userId,
            })
            const chatroomId = res.data;
            onNavigateToChatRoom(chatroomId)
        } catch (error) {
            console.log('Failed to start chat', error)
            setError('Failed to start chat with this user.')
        }
    }

    return (
        <div className="p-4 border rounded shadow-sm bg-white max-w-md mx-auto">
            <h2 className="text-xl font-semibold mb-2">Search Users</h2>
            <div className="flex gap-2 mb-3">
                <input
                    type="text"
                    placeholder="Username or phone number"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="flex-1 border px-3 py-2 rounded"
                />
                <button
                  onClick={handleSearch}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  disabled={loading}
                >
                    {loading ? 'Searching...' : 'Search'}
                </button>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {results.length === 0 && !loading && query && (
                <p className="text-sm text-gray-500">No user found</p>
            )}

            <ul className="space-y-2">
                {results.map((user) => (
                    <li
                      key={user.id}
                      className="flex justify-between items-center border-b py-2"
                    >
                        <span>
                        {user.username}{' '}
                        {user.phoneNumber && (
                            <span className="text-gray-500">({user.phoneNumber})</span>
                        )} 
                        </span>
                        <button
                          onClick={() => handleSendMessage(user.id)}
                          className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                        >
                            Send 
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default UserSearch;