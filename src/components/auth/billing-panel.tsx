import { billingOverview } from "@/lib/billing/runtime";
import { BillingControls } from "./billing-controls";

export async function BillingPanel({
  userId,
  returned,
}: {
  userId: string;
  returned?: string;
}) {
  return (
    <BillingControls
      overview={await billingOverview(userId)}
      returned={returned}
    />
  );
}
