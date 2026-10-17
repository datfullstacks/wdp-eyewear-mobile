import { api } from "./apiClient";
import { getToken } from "./tokenStorage";

export function setupAuthInterceptor() {
  api.interceptors.request.use(async (config) => {
    const token = await getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
}
