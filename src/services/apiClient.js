import axios from "axios";
import { getToken } from "./tokenStorage";
import { getApiBaseUrl } from "./runtimeConfig";

const BASE_URL = getApiBaseUrl();

if (typeof __DEV__ !== "undefined" && __DEV__) {
  // console.log("API baseURL =>", BASE_URL);
}

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use(
  async (config) => {
    const token = await getToken();
    config.headers = config.headers || {};
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
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
