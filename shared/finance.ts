import { z } from "zod";
const cents = z.number().int().safe().min(-99999999999).max(99999999999);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const date = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T12:00:00Z");
    return !isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v;
  });
export const planSchema = z
  .object({
    accounts: z
      .array(
        z.object({
          id: z.string().min(1).max(100),
          name: z.string().trim().min(1).max(50),
          opening: z.record(month, cents),
        }),
      )
      .max(100),
    entries: z
      .array(
        z.object({
          id: z.string().min(1).max(100),
          description: z.string().trim().min(1).max(100),
          type: z.enum(["income", "expense"]),
          amount: cents.refine((v) => v > 0),
          date,
          account: z.string(),
          category: z.string().trim().min(1).max(50),
          status: z.enum(["pending", "done"]),
          statement: z
            .object({
              key: z.string().max(300),
              month,
              purchaseDate: date,
              dueDate: date.optional(),
              card: z.string().max(30),
              installment: z.number().int().min(1).max(999).optional(),
              installments: z.number().int().min(1).max(999).optional(),
              kind: z.enum(["purchase", "fee", "credit"]),
            })
            .optional(),
        }),
      )
      .max(10000),
  })
  .superRefine((p, c) => {
    if (
      new Set(p.accounts.map((a) => a.id)).size !== p.accounts.length ||
      new Set(p.entries.map((a) => a.id)).size !== p.entries.length ||
      p.entries.some((e) => !p.accounts.some((a) => a.id === e.account))
    )
      c.addIssue({
        code: "custom",
        message: "Contas ou lançamentos inválidos",
      });
  });
export type Plan = z.infer<typeof planSchema>;
export type Entry = Plan["entries"][number];
export const emptyPlan: Plan = { accounts: [], entries: [] };
export const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    n / 100,
  );
export function totals(plan: Plan, month: string) {
  const entries = plan.entries.filter((e) => e.date.startsWith(month)),
    opening = plan.accounts.reduce((s, a) => s + (a.opening[month] ?? 0), 0);
  const sum = (list: Entry[]) =>
    list.reduce((s, e) => s + (e.type === "income" ? e.amount : -e.amount), 0);
  return {
    entries,
    balance: opening + sum(entries.filter((e) => e.status === "done")),
    forecast: opening + sum(entries),
    income: entries
      .filter((e) => e.type === "income")
      .reduce((s, e) => s + e.amount, 0),
    expense: entries
      .filter((e) => e.type === "expense")
      .reduce((s, e) => s + e.amount, 0),
  };
}
