export interface FinishedStock {
  car_model_id: number;
  brand_name: string;
  model_name: string;
  size_class: string;
  packed_count: number;
  line_name?: string;
  barcode?: string;
}
