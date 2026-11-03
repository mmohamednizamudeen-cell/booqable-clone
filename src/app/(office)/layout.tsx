import { Frame } from "@/components/app/frame";
import { getOrg } from "@/lib/data/store";

export const dynamic = "force-dynamic";

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const org = await getOrg();
  return <Frame orgName={org.name}>{children}</Frame>;
}
