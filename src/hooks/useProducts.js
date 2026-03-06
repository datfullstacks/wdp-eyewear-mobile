import { useQuery } from "@tanstack/react-query";
import { fetchProducts } from "../services/productService";

export function useProducts() {
  const query = useQuery({
    queryKey: ["products"],
    queryFn: () => fetchProducts({ limit: 100 }),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  return {
    ...query,
    products: query.data || [],
  };
}
