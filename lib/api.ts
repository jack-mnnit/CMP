import { jsonError, jsonOk } from "@/lib/auth";
import { ServiceError } from "@/lib/posts";

/** Maps service-layer errors to consistent JSON responses. */
export function handleServiceError(error: unknown): Response {
  if (error instanceof ServiceError) {
    return jsonError(error.status, error.code, error.message);
  }
  if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002") {
    return jsonError(409, "CONFLICT", "A record with this unique value already exists");
  }
  console.error(error);
  return jsonError(500, "INTERNAL", "An unexpected error occurred");
}

export { jsonOk };
