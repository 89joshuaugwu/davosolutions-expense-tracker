import { z } from "zod";

export const roleSchema = z.enum(["super_admin", "secretary"]);
export const userStatusSchema = z.enum(["active", "deactivated"]);
export type Role = z.infer<typeof roleSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;

export const operationalPermissionsSchema = z.object({
  viewSalaries: z.boolean().default(false),
  viewTransport: z.boolean().default(false),
  viewBills: z.boolean().default(false),
  viewOperationalTotals: z.boolean().default(false),
});

/** The Firestore document ID is the trusted uid; request bodies never set identity. */
export const userProfileSchema = z.object({
  uid: z.string().min(1).max(128),
  name: z.string().trim().min(1).max(120),
  email: z.email(),
  role: roleSchema,
  status: userStatusSchema,
  permissions: operationalPermissionsSchema,
});

export type OperationalPermissions = z.infer<typeof operationalPermissionsSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;

export const defaultSecretaryPermissions: OperationalPermissions = {
  viewSalaries: false,
  viewTransport: false,
  viewBills: false,
  viewOperationalTotals: false,
};
