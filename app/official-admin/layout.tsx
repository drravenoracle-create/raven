import { requireOfficialAdmin } from "../lib/google-admin-auth";

export const dynamic = "force-dynamic";

export default async function OfficialAdminLayout({ children }: { children: React.ReactNode }) {
  await requireOfficialAdmin("/official-admin/sites/");
  return children;
}
