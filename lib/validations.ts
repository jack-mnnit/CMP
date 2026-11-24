import { z } from "zod";

export const POST_STATUSES = ["DRAFT", "PENDING", "PUBLISHED", "SCHEDULED", "PRIVATE", "TRASH"] as const;

const slugField = z
  .string()
  .min(1, "Slug is required")
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug may only contain lowercase letters, numbers and hyphens");

export const postInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  slug: slugField.optional(),
  subtitle: z.string().max(300).optional().nullable(),
  excerpt: z.string().max(500).optional().nullable(),
  content: z.any().optional(),
  contentHtml: z.string().max(500_000).optional(),
  featuredImage: z.string().max(500).optional().nullable(),
  categoryIds: z.array(z.string()).max(20).optional(),
  tagIds: z.array(z.string()).max(50).optional(),
  authorId: z.string().optional(),
  seoTitle: z.string().max(70).optional().nullable(),
  seoDescription: z.string().max(170).optional().nullable(),
  focusKeyword: z.string().max(100).optional().nullable(),
  canonicalUrl: z.string().url().or(z.literal("")).optional().nullable(),
  robotsIndex: z.boolean().optional(),
  robotsFollow: z.boolean().optional(),
  ogImage: z.string().max(500).optional().nullable(),
  allowComments: z.boolean().optional(),
  changeSummary: z.string().max(300).optional(),
});
export type PostInput = z.infer<typeof postInputSchema>;

export const statusChangeSchema = z.object({
  status: z.enum(POST_STATUSES),
  scheduledAt: z.coerce.date().optional().nullable(),
});

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  slug: slugField.optional(),
  description: z.string().max(1000).optional().nullable(),
  parentId: z.string().optional().nullable(),
  image: z.string().max(500).optional().nullable(),
  seoTitle: z.string().max(70).optional().nullable(),
  seoDescription: z.string().max(170).optional().nullable(),
});

export const tagInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  slug: slugField.optional(),
  description: z.string().max(500).optional().nullable(),
});

export const commentInputSchema = z.object({
  postId: z.string().min(1),
  parentId: z.string().optional().nullable(),
  authorName: z.string().trim().min(2, "Name is required").max(80),
  authorEmail: z.string().trim().email("Enter a valid email"),
  content: z.string().trim().min(2, "Comment is too short").max(2000, "Comment is too long"),
  // Honeypot: must stay empty. Bots fill it in.
  website: z.string().max(0).optional(),
});

export const contactInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(10).max(5000),
  website: z.string().max(0).optional(),
});

export const newsletterInputSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  website: z.string().max(0).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().optional(),
});

export const userInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  username: z.string().trim().regex(/^[a-z0-9_-]{3,30}$/, "3-30 chars: a-z, 0-9, _ or -"),
  displayName: z.string().trim().min(2).max(100),
  firstName: z.string().max(60).optional().nullable(),
  lastName: z.string().max(60).optional().nullable(),
  bio: z.string().max(1000).optional().nullable(),
  website: z.string().url().or(z.literal("")).optional().nullable(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "EDITOR", "AUTHOR", "CONTRIBUTOR", "SUBSCRIBER"]).optional(),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
});

export const settingsInputSchema = z.object({
  siteTitle: z.string().trim().min(1).max(100),
  tagline: z.string().max(200),
  siteUrl: z.string().url(),
  adminEmail: z.string().email(),
  postsPerPage: z.coerce.number().int().min(1).max(50),
  allowComments: z.boolean(),
  requireCommentApproval: z.boolean(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  defaultSeoTitle: z.string().max(70).optional().nullable(),
  defaultSeoDescription: z.string().max(170).optional().nullable(),
});
