import UsersList from '../components/UsersList';
import { useUser } from '../context/UserContext';

export default function UsersAdminPage() {
  const { currentUser } = useUser();
  return <UsersList currentUser={currentUser} />;
}
