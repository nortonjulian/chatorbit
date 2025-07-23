import React, { useEffect, useState } from 'react'

export default function UsersList() {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        fetch('http://localhost:5001/users')
          .then(res => {
            if (!res.ok) throw new Error('Failed to fetch users')
            return res.json()
          })
          .then(data => {
            setUsers(data)
            setLoading(false)
          })
          .catch(err => {
            setError(err.message)
            setLoading(false)
          })
    }, [])

    if (loading) return <p>Loading users...</p>
    if (error) return <p>Error: {error}</p>

    return (
        <div>
            <n2>Users</n2>
            {users.length === 0 ? (
                <p>No users found</p>
            ) : (
                <ul>
                    {users.map(user => (
                        <li key={user.id}>
                            {user.username} {user.email ? `(${user.email})` : ''}
                        </li>
                    ))}
                </ul>
                )}
        </div>
    )
}