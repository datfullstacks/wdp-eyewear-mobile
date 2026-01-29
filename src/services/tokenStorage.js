import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "accessToken";

export const saveToken = (token) => SecureStore.setItemAsync(TOKEN_KEY, token);
export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const removeToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);

// tokenStorage.js
// import { Platform } from "react-native";
// import * as SecureStore from "expo-secure-store";

// const TOKEN_KEY = "token";

// export async function getToken() {
//   if (Platform.OS === "web") {
//     return localStorage.getItem(TOKEN_KEY);
//   }
//   return await SecureStore.getItemAsync(TOKEN_KEY);
// }

// export async function setToken(token) {
//   if (Platform.OS === "web") {
//     localStorage.setItem(TOKEN_KEY, token);
//     return;
//   }
//   await SecureStore.setItemAsync(TOKEN_KEY, token);
// }

// export async function removeToken() {
//   if (Platform.OS === "web") {
//     localStorage.removeItem(TOKEN_KEY);
//     return;
//   }
//   await SecureStore.deleteItemAsync(TOKEN_KEY);
// }
