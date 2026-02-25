import { ZodError, type ZodSchema } from "zod";

import { ApiError } from "@/lib/http";

export async function parseBody<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "JSON形式でリクエストしてください。");
  }

  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ApiError(400, "validation_error", "入力値が不正です。", error.flatten());
    }
    throw error;
  }
}
