import OrderEditor from "@/components/OrderEditor";

export default async function Page(props: PageProps<"/order/[id]">) {
  const { id } = await props.params;
  return <OrderEditor orderId={id} />;
}
