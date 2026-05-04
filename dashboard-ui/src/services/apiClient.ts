import axios, { AxiosInstance } from 'axios';

const DEFAULT_BASE_URL = 'http://localhost:4000';

/**
 * Attaches response interceptors to an Axios instance:
 * - 401: redirect to /login (SSR-safe)
 * - 5xx: log the error with status and URL
 */
function attachInterceptors(instance: AxiosInstance): void {
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      const status: number | undefined = error.response?.status;
      const url: string | undefined = error.config?.url;

      if (status === 401) {
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      } else if (status !== undefined && status >= 500) {
        console.log(`[apiClient] ${status} ${url}`);
      }

      return Promise.reject(error);
    }
  );
}

/**
 * Factory function that creates a fresh Axios instance with the standard
 * timeout and interceptors. Used for dependency injection in service functions.
 */
export function createApiClient(baseURL?: string): AxiosInstance {
  const instance = axios.create({
    baseURL: baseURL ?? process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? DEFAULT_BASE_URL,
    timeout: 5000,
  });

  attachInterceptors(instance);

  return instance;
}

/**
 * Centralized Axios instance for use throughout the application.
 * Base URL is read from NEXT_PUBLIC_API_GATEWAY_URL, defaulting to http://localhost:4000.
 */
const apiClient: AxiosInstance = createApiClient();

export default apiClient;
