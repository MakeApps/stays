"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useContext, useMemo, useState } from "react";
import { Toaster } from "sonner";

import { type Currency, currencyOf } from "@/lib/money";
import { createQueryClient } from "@/lib/query";
import type { Capability, SessionUser } from "@/types/api";

const SessionContext = createContext<SessionUser | null>(null);

/** The signed-in user, provided by the server layout so the sidebar renders
 *  without a client fetch waterfall. */
export function useSession(): SessionUser | null {
  return useContext(SessionContext);
}

export function useCan(): (capability: Capability) => boolean {
  const user = useSession();
  return (capability) => Boolean(user?.capabilities.includes(capability));
}

/**
 * The currency the organisation keeps its books in.
 *
 * For the few figures the browser renders itself — a quote while typing, the
 * symbol beside an input. Everything the API sends is already labelled.
 */
export function useCurrency(): Currency {
  const user = useSession();
  return useMemo(() => currencyOf(user?.organisation), [user]);
}

export function Providers({
  user,
  children,
}: {
  user: SessionUser | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  // useState, not useMemo: a client must never be shared between users on the
  // server, and must not be recreated on every render.
  const [queryClient] = useState(createQueryClient);

  const value = useMemo(() => user, [user]);

  return (
    <SessionContext.Provider value={value}>
      <QueryClientProvider client={queryClient}>
        {children}
        {/* Design lines 1801–1813: bottom-right stack, 280–360px, 14px radius,
            large soft shadow, 3600ms — matching the prototype's toast timing.
            `unstyled` removes sonner's own look; the DS classes replace it. */}
        <Toaster
          position="bottom-right"
          duration={3600}
          gap={10}
          offset={24}
          toastOptions={{
            unstyled: true,
            classNames: {
              toast: "ls-toast",
              title: "ls-toast-title",
              description: "ls-toast-body",
              icon: "ls-toast-icon",
            },
          }}
        />
      </QueryClientProvider>
    </SessionContext.Provider>
  );
}
