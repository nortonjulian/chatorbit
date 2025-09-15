import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UsersList from '../components/UsersList';
import { useUser } from '../context/UserContext';
import { toast } from '../utils/toast';

export default function UsersAdminPage() {
  const { currentUser } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role !== 'ADMIN') {
      toast.err('Admin access required');
      navigate('/', { replace: true });
    }
  }, [currentUser, navigate]);

  if (!currentUser || currentUser.role !== 'ADMIN') {
    return null;
  }

  return <UsersList currentUser={currentUser} />;
}
