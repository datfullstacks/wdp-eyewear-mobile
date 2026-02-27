import axios from "axios";
import { useAuthStore } from "../store/authStore";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (typeof __DEV__ !== "undefined" && __DEV__) {
  console.log("API baseURL =>", BASE_URL);
}

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers = config.headers || {};
    config.headers.accept = "application/json";
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error?.response?.status === 401) {
    }
    return Promise.reject(error);
  }
);