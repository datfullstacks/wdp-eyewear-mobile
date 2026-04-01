import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppNavigation from "./src/app/AppNavigation";
import { setupAuthInterceptor } from "./src/services/attachAuth";
import Toast from "react-native-toast-message";

const queryClient = new QueryClient();

export default function App() {
  useEffect(() => {
    setupAuthInterceptor();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppNavigation />
      <Toast />
    </QueryClientProvider>
  );
}
