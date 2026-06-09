export const APP_NAME = 'DRA';
export const APP_VERSION = '0.1.0';

/** Standard API success response */
export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

/** Standard API error response */
export interface ApiError {
  ok: false;
  error: string;
  code: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
