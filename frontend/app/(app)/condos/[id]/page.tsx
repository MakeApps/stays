import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CondoDetailPage } from "@/features/condos/CondoDetailPage";
import { getCondo } from "@/features/condos/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const condo = await getCondo((await params).id);
  return { title: condo?.name ?? "Condo" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const condo = await getCondo((await params).id);
  if (!condo) notFound();
  return <CondoDetailPage condo={condo} />;
}
