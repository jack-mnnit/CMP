import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getPublishedPostBySlug } from "@/lib/posts";
import { formatDate } from "@/lib/utils";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) return { title: "Not found" };
  return {
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt ?? undefined,
  };
}

export default async function BlogPostPage({ params }: { params: Params }) {
  await connection();
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/" className="text-sm text-blue-600 hover:underline">← Back to blog</Link>
      <article className="mt-6">
        <h1 className="text-4xl font-bold leading-tight">{post.title}</h1>
        {post.subtitle && <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">{post.subtitle}</p>}
        <p className="mt-4 text-sm text-slate-500">
          {post.author.displayName} · {formatDate(post.publishedAt)} · {post.readingTime} min read
        </p>
        {post.featuredImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.featuredImage} alt="" className="mt-8 w-full rounded-xl" />
        )}
        <div
          className="prose prose-slate mt-8 max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />
      </article>
    </main>
  );
}
