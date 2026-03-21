import { useQuery } from "@tanstack/react-query";
import { fetchStores } from "../services/storeService";

export function useStores() {
  const query = useQuery({
    queryKey: ["stores"],
    queryFn: () => fetchStores({ limit: 100, status: "active" }),
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  return {
    ...query,
    stores: query.data || [],
  };
}
