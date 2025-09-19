import { useUser } from '@/context/UserContext';

export default function useIsPremium() {
  const ctx = (typeof useUser === 'function' ? useUser() : null) || null;
  const currentUser = ctx?.currentUser || null;
  const plan = (currentUser?.plan || 'FREE').toUpperCase?.() || 'FREE';
  return currentUser?.role === 'ADMIN' || ['PREMIUM', 'PRO', 'PLUS'].includes(plan);
}
