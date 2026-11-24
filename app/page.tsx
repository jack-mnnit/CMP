import { redirect } from "next/navigation";

// Public blog home is not built yet; send visitors to the admin area for now.
export default function HomePage() {
  redirect("/admin/dashboard");
}
