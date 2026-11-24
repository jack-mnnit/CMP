import { PrismaClient, Role, PostStatus, CommentStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@blogmaster.local";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin12345!";

const CATEGORIES = [
  "Technology", "Design", "Business", "Lifestyle", "Travel",
  "Health", "Food", "Science", "Education", "Finance",
];

const TAGS = [
  "nextjs", "react", "typescript", "prisma", "postgresql", "tailwind", "seo", "startups",
  "productivity", "ux", "writing", "photography", "remote-work", "marketing", "security",
  "accessibility", "performance", "open-source", "careers", "travel-tips",
];

const AUTHORS = [
  { username: "alice", displayName: "Alice Morgan", role: Role.ADMIN },
  { username: "ben", displayName: "Ben Carter", role: Role.EDITOR },
  { username: "chloe", displayName: "Chloe Diaz", role: Role.AUTHOR },
  { username: "dev", displayName: "Dev Patel", role: Role.AUTHOR },
  { username: "emma", displayName: "Emma Stone", role: Role.CONTRIBUTOR },
];

const TOPICS = [
  "Getting started with", "A practical guide to", "Ten lessons from", "Why you should try",
  "Common mistakes with", "The future of", "Advanced tips for", "A beginner's look at",
];

const SUBJECTS = [
  "server components", "content modeling", "editorial workflows", "responsive layouts",
  "database migrations", "newsletter growth", "search engine optimisation", "accessible forms",
  "image optimisation", "remote teams", "API design", "static site generation",
];

function paragraphDoc(text: string) {
  return {
    type: "doc",
    content: text.split("\n\n").map((p) => ({
      type: "paragraph",
      content: [{ type: "text", text: p }],
    })),
  };
}

function toHtml(text: string) {
  return text.split("\n\n").map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`).join("");
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function main() {
  console.log("Seeding BlogMaster CMS...");

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      username: "admin",
      passwordHash,
      displayName: "Site Administrator",
      role: Role.SUPER_ADMIN,
    },
  });

  const authors = [];
  for (const a of AUTHORS) {
    const user = await prisma.user.upsert({
      where: { email: `${a.username}@blogmaster.local` },
      update: {},
      create: {
        email: `${a.username}@blogmaster.local`,
        username: a.username,
        passwordHash,
        displayName: a.displayName,
        bio: `${a.displayName} writes about the web, design and product.`,
        role: a.role,
      },
    });
    authors.push(user);
  }
  const everyone = [admin, ...authors];

  const categories = [];
  for (const name of CATEGORIES) {
    const slug = slugify(name);
    categories.push(
      await prisma.category.upsert({
        where: { slug },
        update: {},
        create: { name, slug, description: `Articles about ${name.toLowerCase()}.` },
      }),
    );
  }

  const tags = [];
  for (const name of TAGS) {
    const slug = slugify(name);
    tags.push(await prisma.tag.upsert({ where: { slug }, update: {}, create: { name, slug } }));
  }

  // 60 published posts spread across the last 90 days
  const now = Date.now();
  let postCount = 0;
  for (let i = 0; i < 60; i++) {
    const title = `${TOPICS[i % TOPICS.length]} ${SUBJECTS[i % SUBJECTS.length]} (part ${Math.floor(i / SUBJECTS.length) + 1})`;
    const slug = slugify(title);
    const exists = await prisma.post.findUnique({ where: { slug } });
    if (exists) continue;

    const body = [
      `This article explores ${SUBJECTS[i % SUBJECTS.length]} with concrete examples drawn from real projects.`,
      `The first step is to define what success looks like. Clear goals make every later decision easier to judge.`,
      `Next, build a small prototype and measure it. Small experiments reveal problems that planning often misses.`,
      `Finally, share what you learned with your team and iterate. Good writing and good software both improve through feedback.`,
    ].join("\n\n");

    const author = everyone[i % everyone.length];
    const publishedAt = new Date(now - (i * 36 + 1) * 3600 * 1000);
    const post = await prisma.post.create({
      data: {
        title,
        slug,
        subtitle: "A short guide with practical takeaways",
        excerpt: body.slice(0, 160),
        content: paragraphDoc(body),
        contentHtml: toHtml(body),
        status: PostStatus.PUBLISHED,
        publishedAt,
        readingTime: 3 + (i % 5),
        viewCount: (i * 37) % 900,
        featuredImage: `https://picsum.photos/seed/${slug}/1200/630`,
        authorId: author.id,
        categories: { create: [{ categoryId: categories[i % categories.length].id }] },
        tags: {
          create: [
            { tagId: tags[i % tags.length].id },
            { tagId: tags[(i + 3) % tags.length].id },
          ],
        },
      },
    });
    postCount++;

    // Two approved comments on every other post
    if (i % 2 === 0) {
      await prisma.comment.create({
        data: {
          postId: post.id,
          content: "Thanks for the clear explanation. The prototype advice was especially useful.",
          status: CommentStatus.APPROVED,
          authorName: "Reader One",
          authorEmail: `reader${i}@example.com`,
        },
      });
    }
  }

  // A few drafts and a scheduled post for the editorial dashboard
  for (const [idx, status] of [[0, PostStatus.DRAFT], [1, PostStatus.DRAFT], [2, PostStatus.SCHEDULED]] as const) {
    const title = `Upcoming draft ${idx + 1}: notes on ${SUBJECTS[idx]}`;
    const body = "Work in progress. Outline the key points before publishing.";
    await prisma.post.upsert({
      where: { slug: slugify(title) },
      update: {},
      create: {
        title,
        slug: slugify(title),
        content: paragraphDoc(body),
        contentHtml: toHtml(body),
        status,
        scheduledAt: status === PostStatus.SCHEDULED ? new Date(now + 7 * 86400000) : null,
        authorId: admin.id,
      },
    });
  }

  await prisma.siteSettings.upsert({
    where: { id: "site" },
    update: {},
    create: {
      id: "site",
      siteTitle: "BlogMaster",
      tagline: "Manage your content. Grow your audience.",
    },
  });

  await prisma.notification.create({
    data: { message: "Welcome to BlogMaster CMS. Your demo content is ready.", link: "/admin/posts" },
  }).catch(() => undefined);

  console.log(`Seed complete: ${postCount} new posts, ${categories.length} categories, ${tags.length} tags, ${authors.length + 1} users.`);
  console.log(`Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
