import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { ModuleCard } from "@/components/module-card";
import { CategoryFilter } from "@/components/category-filter";
import { SearchBar } from "@/components/search-bar";

// TODO [medium-challenge]: Add category filter with URL query params (state persists on refresh)
// Done: Implemented multi-select category filter with URL persistence.

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string | string[] }>;
}) {
  const { q, category } = await searchParams;
  const categoriesParam = Array.isArray(category) ? category : category ? [category] : [];

  const session = await auth();

  const modules = await db.miniApp.findMany({
    where: {
      status: "APPROVED",
      ...(categoriesParam.length > 0 ? { category: { slug: { in: categoriesParam } } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    // DO NOT remove include — avoids N+1 on category/author fields.
    include: {
      category: true,
      author: { select: { id: true, name: true, image: true } },
    },
    orderBy: { voteCount: "desc" },
    take: 12,
  });

  // Fetch which modules the current user has voted on
  let votedIds = new Set<string>();
  if (session?.user) {
    const votes = await db.vote.findMany({
      where: {
        userId: session.user.id,
        moduleId: { in: modules.map((m) => m.id) },
      },
      select: { moduleId: true },
    });
    votedIds = new Set(votes.map((v) => v.moduleId));
  }

  const categories = await db.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Community Modules</h1>
          <p className="text-sm text-muted-foreground">
            Discover mini-apps built by the Intern developer community.
          </p>
        </div>

        <SearchBar />
      </div>

      <CategoryFilter categories={categories} />

      {modules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500">No modules found.</p>
          {q && (
            <Link href="/" className="mt-2 block text-sm text-primary hover:underline transition-colors">
              Clear search
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              hasVoted={votedIds.has(module.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
