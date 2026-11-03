import { notFound } from "next/navigation";
import { Page } from "@/components/app/page";
import { getOrg, getProduct, productStock } from "@/lib/data/store";
import { ProductEditor } from "./product-editor";

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ stockError?: string }> }) {
  const { id } = await params;
  const { stockError } = await searchParams;
  const product = await getProduct(id);
  if (!product) notFound();
  const [stock, org] = await Promise.all([productStock(id), getOrg()]);
  return (
    <Page title={product.name} breadcrumb={["Inventory"]}>
      <ProductEditor product={product} stock={stock} currency={org.currency} stockError={stockError} />
    </Page>
  );
}
