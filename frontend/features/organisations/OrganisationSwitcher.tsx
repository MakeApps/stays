"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useState } from "react";
import { toast } from "sonner";

import { CheckIcon, ChevronDownIcon, PlusIcon } from "@/components/layout/icons";
import { useCan, useSession } from "@/components/providers/Providers";
import { NewOrganisationModal } from "@/features/organisations/NewOrganisationModal";
import { useOrganisations, useSwitchOrganisation } from "@/features/organisations/api";
import { ApiError } from "@/services/http";

/**
 * Which organisation the whole app is showing, and the way to change it.
 *
 * Sits directly under the wordmark because it qualifies everything below it:
 * every screen in the sidebar is scoped to whatever this says. Hidden entirely
 * when there is only one and no power to make another — a picker with a single
 * option is furniture.
 */
export function OrganisationSwitcher({ collapsed }: { collapsed: boolean }) {
  const user = useSession();
  const can = useCan();
  const [creating, setCreating] = useState(false);

  const { data } = useOrganisations();
  const switcher = useSwitchOrganisation();

  const current = user?.organisation;
  const items = data?.items ?? (current ? [current] : []);
  const mayCreate = can("organisation:write");

  if (!current) return null;
  if (items.length < 2 && !mayCreate) {
    return <div className="org-current org-static">{current.name}</div>;
  }

  async function switchTo(id: string) {
    if (id === current?.id) return;
    try {
      await switcher.mutateAsync(id);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "The server did not respond.";
      toast.error("Could not switch organisation", { description: message });
    }
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="org-switch"
            // In the rail the label is display:none, which strips the
            // accessible name, so it is spelled out here as well.
            aria-label={`Organisation: ${current.name}`}
            title={current.name}
            disabled={switcher.isPending}
          >
            <span className="org-mark" aria-hidden="true">
              {current.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="org-name">{current.name}</span>
            <ChevronDownIcon size={14} />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="org-menu"
            align={collapsed ? "center" : "start"}
            sideOffset={6}
          >
            <div className="org-menu-label">Organisations</div>
            {items.map((org) => (
              <DropdownMenu.Item
                key={org.id}
                className="org-menu-item"
                onSelect={() => void switchTo(org.id)}
              >
                <span className="org-mark" aria-hidden="true">
                  {org.name.slice(0, 1).toUpperCase()}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="org-menu-name">{org.name}</span>
                  <span className="org-menu-role">{org.role}</span>
                </span>
                {org.id === current.id ? <CheckIcon size={15} /> : null}
              </DropdownMenu.Item>
            ))}

            {mayCreate ? (
              <>
                <DropdownMenu.Separator className="org-menu-sep" />
                <DropdownMenu.Item
                  className="org-menu-item"
                  onSelect={() => setCreating(true)}
                >
                  <PlusIcon size={16} />
                  <span>New organisation</span>
                </DropdownMenu.Item>
              </>
            ) : null}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <NewOrganisationModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
