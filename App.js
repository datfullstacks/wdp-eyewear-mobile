import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppNavigation from "./src/app/AppNavigation";
import { setupAuthInterceptor } from "./src/services/attachAuth";
import Toast from "react-native-toast-message";
import { useFavoriteStore } from "./src/store/favoriteStore";

const queryClient = new QueryClient();

export default function App() {
  useEffect(() => {
    setupAuthInterceptor();

    // ✅ hydrate favorites 1 lần khi app mở
    const fav = useFavoriteStore.getState();
    if (fav?.isHydrating) fav.hydrate();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppNavigation />
      <Toast />
    </QueryClientProvider>
  );
}
