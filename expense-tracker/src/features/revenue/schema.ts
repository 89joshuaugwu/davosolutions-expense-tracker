import { z } from "zod";

export const createRevenueSourceSchema = z.object({
  name: z.string().min(2).max(100),
  status: z.enum(["active", "archived"]).default("active"),
  sortOrder: z.number().int().default(0),
});

export type CreateRevenueSourceDto = z.infer<typeof createRevenueSourceSchema>;

export const updateRevenueSourceSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  status: z.enum(["active", "archived"]).optional(),
  sortOrder: z.number().int().optional(),
});

export type UpdateRevenueSourceDto = z.infer<typeof updateRevenueSourceSchema>;

export const createRevenueSchema = z.object({
  sourceId: z.string().min(1),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD."),
  amount: z.string().trim().regex(/^(0|[1-9]\d*)(?:\.\d+)?$/, "Enter a valid positive number.").max(32),
  currency: z.string().trim().min(1).max(10),
  description: z.string().max(200).optional().default(""),
  notes: z.string().max(1000).optional().default(""),
  attachmentIds: z.array(z.string()).max(5).default([]),
  idempotencyKey: z.string().min(1).max(100),
});

export type CreateRevenueDto = z.infer<typeof createRevenueSchema>;

export const correctRevenueSchema = z.object({
  sourceId: z.string().min(1).optional(),
  date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  expectedRevision: z.number().int().min(0),
  reason: z.string().min(5).max(500),
});

export type CorrectRevenueDto = z.infer<typeof correctRevenueSchema>;

export const archiveRevenueSchema = z.object({
  expectedRevision: z.number().int().min(0),
  reason: z.string().min(5).max(500),
});

export type ArchiveRevenueDto = z.infer<typeof archiveRevenueSchema>;
