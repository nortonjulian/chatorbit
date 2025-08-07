import React, { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';

export default function UsersList({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axiosClient.get('/users');
        setUsers(res.data);
      } catch (err) {
        if (err.response?.status === 401) {
          // Token expired or unauthorized → force logout
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.reload();
        }
        setError(err.response?.data?.error || 'Failed to fetch users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  if (loading) return <p>Loading users...</p>;
  if (error) return <p className="text-red-500">Error: {error}</p>;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Users</h2>
      {users.length === 0 ? (
        <p>No users found</p>
      ) : (
        <ul className="space-y-1">
          {users.map((user) => (
            <li key={user.id} className="flex justify-between border-b py-1">
              <span>{user.username}</span>
              {currentUser?.role === 'ADMIN' && (
                <span className="text-gray-500 text-sm">
                  {user.email || 'No email'}
                  {user.phoneNumber && ` • ${user.phoneNumber}`}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
