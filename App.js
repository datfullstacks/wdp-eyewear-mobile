import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppNavigation from "./src/app/AppNavigation";
import { setupAuthInterceptor } from "./src/services/attachAuth";

const queryClient = new QueryClient();

export default function App() {
  useEffect(() => {
    setupAuthInterceptor();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppNavigation />
    </QueryClientProvider>
  );
}
