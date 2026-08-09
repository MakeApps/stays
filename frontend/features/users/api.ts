import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { qk } from "@/lib/query";
import { api, qs } from "@/services/http";
import type { TeamListResponse, TeamMember } from "@/types/api";

export interface UserInput {
  full_name: string;
  email: string;
  password: string;
}

export function useUsers(q?: string) {
  return useQuery({
    queryKey: qk.users.list(q ?? null),
    queryFn: () => api.get<TeamListResponse>(`/users${qs({ q })}`),
    // Keeps the list on screen while a search is in flight rather than
    // blanking it on every keystroke.
    placeholderData: (previous) => previous,
  });
}

/** Anything that touches an account also moves the activity feed. */
function useInvalidateUsers() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: qk.users.all });
    void client.invalidateQueries({ queryKey: qk.activity.all });
  };
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (input: UserInput) => api.post<TeamMember>("/users", input),
    onSuccess: invalidate,
  });
}

export function useUpdateUser(id: string) {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (input: Partial<UserInput> & { is_active?: boolean }) =>
      api.patch<TeamMember>(`/users/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/users/${id}`),
    onSuccess: invalidate,
  });
}
