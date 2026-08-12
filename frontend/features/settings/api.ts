import { useMutation } from "@tanstack/react-query";

import { api } from "@/services/http";
import type { SessionUser } from "@/types/api";

export interface ChangePasswordInput {
  current_password: string;
  new_password: string;
}

interface ChangePasswordResponse {
  user: SessionUser;
  access_expires_at: string;
}

/**
 * Nothing to invalidate on success.
 *
 * The response carries a replacement cookie pair — the server revokes every
 * session, this one included, and re-issues — so the cached queries are still
 * valid for the same user. Re-fetching them would be busywork.
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      api.post<ChangePasswordResponse>("/auth/password", input),
  });
}
