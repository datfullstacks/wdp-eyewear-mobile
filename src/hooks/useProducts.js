import { useQuery } from "@tanstack/react-query";
import { fetchProducts } from "../services/productService";

export function useProducts(params = {}) {
  const query = useQuery({
    queryKey: ["products", params.storeId || "all"],
    queryFn: () =>
      fetchProducts({
        limit: 100,
        ...(params.storeId ? { storeId: params.storeId } : {}),
      }),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  return {
    ...query,
    products: query.data || [],
  };
}
