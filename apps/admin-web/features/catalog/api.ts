import { http } from "@/lib/api-client";
import type { Brand, CarItem, CarItemInput, ProductLine } from "./types";

const d = (r: any) => r.data?.data ?? r.data;
export const catalogApi = {
  items: async (): Promise<CarItem[]> => d(await http.get("/car-models")),
  brands: async (): Promise<Brand[]> => d(await http.get("/car-brands")),
  lines: async (): Promise<ProductLine[]> => d(await http.get("/product-lines")),
  createBrand: async (name: string): Promise<Brand> => d(await http.post("/car-brands", { name })),
  createItem: async (input: CarItemInput) => d(await http.post("/car-models", input)),
  updateItem: async (id: number, patch: Partial<CarItemInput> & { is_active?: boolean }) =>
    d(await http.patch(`/car-models/${id}`, patch)),
};
