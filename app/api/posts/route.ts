import { apiUser, jsonError, jsonOk } from "@/lib/auth";
import { postInputSchema } from "@/lib/validations";
import { listPosts, savePost } from "@/lib/posts";
import { handleServiceError } from "@/lib/api";

export async function GET(request: Request) {
  const auth = await apiUser();
  if ("error" in auth) return auth.error;

  const sp = new URL(request.url).searchParams;
  const ownOnly = ["CONTRIBUTOR", "AUTHOR", "SUBSCRIBER"].includes(auth.user.role);
  const result = await listPosts({
    page: Number(sp.get("page") ?? 1),
    pageSize: Number(sp.get("pageSize") ?? 10),
    status: sp.get("status") ?? undefined,
    search: sp.get("search") ?? undefined,
    sort: sp.get("sort") ?? undefined,
    categoryId: sp.get("categoryId") ?? undefined,
    tagId: sp.get("tagId") ?? undefined,
    authorId: ownOnly ? auth.user.id : (sp.get("authorId") ?? undefined),
  });
  return jsonOk(result.items, 200, result.pagination);
}

export async function POST(request: Request) {
  const auth = await apiUser("posts:create");
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => null);
  const parsed = postInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "VALIDATION", "Invalid post data", parsed.error.flatten().fieldErrors);
  }
  try {
    const post = await savePost(auth.user, parsed.data);
    return jsonOk(post, 201);
  } catch (error) {
    return handleServiceError(error);
  }
}
