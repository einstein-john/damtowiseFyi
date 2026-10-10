/** Single error envelope for every failed API response. */
export interface ApiErrorBody {
  error: string;
  message?: string;
  issues?: Array<{ path: string; message: string }>;
}