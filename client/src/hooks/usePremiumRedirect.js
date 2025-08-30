import { useNavigate } from 'react-router-dom';
import useIsPremium from './useIsPremium';

export default function usePremiumRedirect() {
  const navigate = useNavigate();
  const isPremium = useIsPremium();
  // returns true if we redirected (caller should stop), false otherwise
  return function guard() {
    if (!isPremium) {
      navigate('/settings/upgrade');
      return true;
    }
    return false;
  };
}
