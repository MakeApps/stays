import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { qk } from "@/lib/query";
import { api, apiFetch, qs } from "@/services/http";
import type {
  Expense,
  ExpenseListResponse,
  ExpenseSummary,
  IncomeSummary,
  Lookups,
} from "@/types/api";

export interface ExpenseFilters {
  q?: string;
  condo_id?: string;
  category_id?: string;
  status?: string;
  start?: string;
  end?: string;
  page?: number;
  per_page?: number;
  sort?: string;
  order?: "asc" | "desc";
}

export interface ExpenseInput {
  condo_id: string;
  category_id: string;
  method_id: string;
  spent_on: string;
  amount: string;
  description: string;
  vendor?: string | null;
  reference?: string | null;
  status: string;
  notes?: string | null;
}

export function useLookups() {
  return useQuery({
    queryKey: qk.expenses.lookups,
    queryFn: () => api.get<Lookups>("/expenses/lookups"),
    // Categories and methods change about once a year.
    staleTime: 60 * 60_000,
  });
}

export function useExpenses(filters: ExpenseFilters) {
  return useQuery({
    queryKey: qk.expenses.list(filters as Record<string, unknown>),
    queryFn: () => api.get<ExpenseListResponse>(`/expenses${qs({ ...filters })}`),
    placeholderData: (previous) => previous,
  });
}

export function useExpenseSummary(month?: string) {
  return useQuery({
    queryKey: qk.expenses.summary(month ?? null),
    queryFn: () => api.get<ExpenseSummary>(`/expenses/summary${qs({ month })}`),
  });
}

export function useIncomeSummary(month?: string) {
  return useQuery({
    queryKey: qk.income.summary(month ?? null),
    queryFn: () => api.get<IncomeSummary>(`/income/summary${qs({ month })}`),
  });
}

/** Money moved, so every derived figure in the product is now stale. */
function useInvalidateMoney() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: qk.expenses.all });
    void client.invalidateQueries({ queryKey: qk.income.all });
    void client.invalidateQueries({ queryKey: qk.condos.all });
    void client.invalidateQueries({ queryKey: qk.activity.all });
  };
}

export function useCreateExpense() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (input: ExpenseInput) => api.post<Expense>("/expenses", input),
    onSuccess: invalidate,
  });
}

export function useUpdateExpense(id: string) {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (input: Partial<ExpenseInput>) => api.patch<Expense>(`/expenses/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteExpense() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/expenses/${id}`),
    onSuccess: invalidate,
  });
}

export function useUploadReceipt(id: string) {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return apiFetch<Expense>(`/expenses/${id}/receipt`, { method: "POST", body: form });
    },
    onSuccess: invalidate,
  });
}
