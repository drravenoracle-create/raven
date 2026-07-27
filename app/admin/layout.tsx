import Link from "next/link";
import { requireChatGPTUser } from "../chatgpt-auth";

const DEFAULT_ADMIN_EMAIL = "dr.ravenoracle@gmail.com";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireChatGPTUser("/admin/");
  const adminEmail = process.env.RAVEN_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;

  if (user.email.toLowerCase() !== adminEmail.toLowerCase()) {
    return (
      <main className="min-h-screen bg-[#f5f0e8] px-5 py-8 text-[#20241f]">
        <div className="mx-auto max-w-3xl">
          <Link className="text-sm font-semibold text-[#596d51]" href="/">Raven Oracle</Link>
          <section className="mt-8 rounded border border-[#d7cabc] bg-[#fffaf2] p-6">
            <p className="text-sm font-semibold uppercase text-[#6c5f3d]">Admin</p>
            <h1 className="mt-2 text-3xl font-semibold">管理画面にアクセスできません</h1>
            <p className="mt-3 leading-7 text-[#5e625c]">
              この管理画面は Raven Oracle のオーナー専用です。別のアカウントでサインインしている場合は、正しいアカウントで入り直してください。
            </p>
          </section>
        </div>
      </main>
    );
  }

  return children;
}