import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock("@/app/account/billing-actions", () => ({
  startCheckout: vi.fn(),
  openBillingPortal: vi.fn(),
  refreshBilling: vi.fn(),
}));
import { BillingControls } from "./billing-controls";
import type { BillingOverview } from "@/lib/billing/types";
const current: BillingOverview = {
  available: false,
  hasCustomer: true,
  canSubscribe: false,
  status: "active",
  paidUntil: "2030-01-01T00:00:00.000Z",
  cancelAtPeriodEnd: false,
  priceLabel: null,
  plans: [],
  currentInterval: "month",
};
describe("membership controls", () => {
  it("keeps management, refresh and paid dates visible when price lookup fails", () => {
    const html = renderToStaticMarkup(<BillingControls overview={current} />);
    expect(html).toContain("Manage billing");
    expect(html).toContain("Refresh billing status");
    expect(html).toContain("Paid access through");
    expect(html).not.toContain("Upgrade to PRO (test)");
  });
  it("offers accessible monthly and yearly choices using server prices", () => {
    const html = renderToStaticMarkup(
      <BillingControls
        overview={{
          ...current,
          hasCustomer: false,
          canSubscribe: true,
          available: true,
          status: null,
          plans: [
            { interval: "month", label: "$10.00 CAD / month" },
            { interval: "year", label: "$100.00 CAD / year" },
          ],
        }}
      />,
    );
    expect(html.match(/type="radio"/g)).toHaveLength(2);
    expect(html).toContain("Monthly");
    expect(html).toContain("Yearly");
    expect(html).toContain("$100.00 CAD / year");
    expect(html).toContain("Upgrade to PRO (test)");
  });
});
