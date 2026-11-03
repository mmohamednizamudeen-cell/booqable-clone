import { Page } from "@/components/app/page";
import { getOrg, listCustomers } from "@/lib/data/store";
import { ListSearch } from "../inventory/filters";
import { CustomerTable, NewCustomerButton } from "./customer-table";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const [rows, org] = await Promise.all([listCustomers(q), getOrg()]);
  return (
    <Page title="Customers" search={<ListSearch placeholder="Name or email" defaultValue={q} />} actions={<NewCustomerButton />}>
      <ListSearch className="md:hidden" placeholder="Name or email" defaultValue={q} />
      <CustomerTable rows={rows} currency={org.currency} timeZone={org.timeZone} filtered={Boolean(q)} />
    </Page>
  );
}
