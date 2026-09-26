export interface Brand {
  id: number;
  name: string;
}
export interface ProductLine {
  id: number;
  code: string;
  name: string;
}
export interface CarItem {
  id: number;
  brand_name: string;
  name: string;
  size_class: "small" | "medium" | "large";
  pieces_per_set: number;
  line_code?: string;
  line_name?: string;
  barcode?: string;
  is_active: boolean;
}
export interface CarItemInput {
  brand_id: number;
  name: string;
  size_class: string;
  pieces_per_set: number;
  product_line_id: number;
  barcode?: string;
}
