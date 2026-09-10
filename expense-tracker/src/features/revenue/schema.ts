import { z } from "zod";
import { dateOnlySchema } from "@/domain/dates";
import { currencySchema, amountStringSchema } from "@/domain/money";

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
  date: dateOnlySchema,
  amount: amountStringSchema,
  currency: currencySchema,
  description: z.string().max(200).optional().default(""),
  notes: z.string().max(1000).optional().default(""),
  attachmentIds: z.array(z.string()).max(5).default([]),
  idempotencyKey: z.string().min(1).max(100),
});

export type CreateRevenueDto = z.infer<typeof createRevenueSchema>;

export const correctRevenueSchema = z.object({
  sourceId: z.string().min(1).optional(),
  date: dateOnlySchema.optional(),
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
