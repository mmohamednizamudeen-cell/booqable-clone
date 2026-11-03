import { Page } from "@/components/app/page";
import { getOrg } from "@/lib/data/store";
import { NewProductForm } from "./new-product-form";

export default async function NewProductPage() {
  const org = await getOrg();
  return (
    <Page title="New product" breadcrumb={["Inventory"]}>
      <NewProductForm currency={org.currency} />
    </Page>
  );
}
