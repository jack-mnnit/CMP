import { destroySession, jsonOk } from "@/lib/auth";

export async function POST() {
  await destroySession();
  return jsonOk({ loggedOut: true });
}
