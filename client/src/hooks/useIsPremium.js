import { useUser } from '@/context/UserContext';

export default function useIsPremium() {
  const { currentUser } = useUser();
  const plan = (currentUser?.plan || 'FREE').toUpperCase();
  return currentUser?.role === 'ADMIN' || ['PREMIUM', 'PRO', 'PLUS'].includes(plan);
}
