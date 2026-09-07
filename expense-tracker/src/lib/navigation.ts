import { Activity, ArrowLeftRight, ChartNoAxesCombined, CircleDollarSign, ClipboardList, FolderOpen, LayoutDashboard, ReceiptText, Settings2, ShieldCheck, Users, Wallet, type LucideIcon } from "lucide-react";

export type Section = "dashboard" | "expenses" | "salaries" | "transport" | "bills" | "monthly-funds" | "revenue" | "profit-loss" | "reports" | "audit-log" | "users" | "settings";
export type NavItem = { key: Section; label: string; group: "Workspace" | "Finance" | "Administration"; icon: LucideIcon; description: string };
export const navigation: NavItem[] = [
  { key: "dashboard", label: "Overview", group: "Workspace", icon: LayoutDashboard, description: "Your company finances, in one place." },
  { key: "expenses", label: "Expenses", group: "Workspace", icon: ReceiptText, description: "Every expense, with the details that matter." },
  { key: "salaries", label: "Salary log", group: "Workspace", icon: Users, description: "A clear record of your team’s salary payments." },
  { key: "transport", label: "Transportation", group: "Workspace", icon: ArrowLeftRight, description: "Morning, evening, and extra journeys accounted for." },
  { key: "bills", label: "Bills & reminders", group: "Workspace", icon: ClipboardList, description: "Keep track of commitments and upcoming payments." },
  { key: "monthly-funds", label: "Monthly funds", group: "Finance", icon: Wallet, description: "Set the opening allocation for each month." },
  { key: "revenue", label: "Revenue", group: "Finance", icon: CircleDollarSign, description: "Understand what’s coming in and where it comes from." },
  { key: "profit-loss", label: "Profit & loss", group: "Finance", icon: ChartNoAxesCombined, description: "Revenue and expenses, with a clear view of the difference." },
  { key: "reports", label: "Reports", group: "Finance", icon: FolderOpen, description: "Turn your financial records into useful reports." },
  { key: "audit-log", label: "Audit trail", group: "Administration", icon: Activity, description: "A traceable history of activity and corrections." },
  { key: "users", label: "Team & access", group: "Administration", icon: ShieldCheck, description: "Give each team member the access they need." },
  { key: "settings", label: "Settings", group: "Administration", icon: Settings2, description: "Manage your company preferences and financial configuration." },
];

export function isSection(value: string): value is Section { return navigation.some((item) => item.key === value); }
