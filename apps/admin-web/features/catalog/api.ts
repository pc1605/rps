import type { AxiosResponse } from "axios";
import { http } from "@/lib/api-client";
import type { Brand, CarItem, CarItemInput, ProductLine } from "./types";

type Envelope<T> = { data: T };

/** Unwrap the backend's {"data": …} envelope. */
const d = <T>(r: AxiosResponse<Envelope<T>>): T => r.data.data;

export const catalogApi = {
  items: async () => d(await http.get<Envelope<CarItem[]>>("/car-models")),
  brands: async () => d(await http.get<Envelope<Brand[]>>("/car-brands")),
  lines: async () => d(await http.get<Envelope<ProductLine[]>>("/product-lines")),
  createBrand: async (name: string) => d(await http.post<Envelope<Brand>>("/car-brands", { name })),
  createItem: async (input: CarItemInput) =>
    d(await http.post<Envelope<{ id: number; barcode: string }>>("/car-models", input)),
  updateItem: async (id: number, patch: Partial<CarItemInput> & { is_active?: boolean }) =>
    d(await http.patch<Envelope<{ message: string }>>(`/car-models/${id}`, patch)),
};
