import axios from 'axios';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001',
  withCredentials: false,
  timeout: 20_000,
});

// Attach token automatically
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token'); // or your secure storage wrapper
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401s consistently
axiosClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      // optional: central place to “log out”
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // You can also emit a custom event and have a top-level listener reload:
      window.dispatchEvent(new Event('auth-logout'));
    }
    return Promise.reject(err);
  }
);

export default axiosClient;
