// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const { social } = vi.hoisted(() => ({
  social: vi.fn().mockResolvedValue({ data: null, error: null }),
}));
vi.mock("@/lib/auth/client", () => ({
  authClient: { signIn: { social } },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace() {}, refresh() {} }),
}));
import { AuthForm } from "./auth-form";
import { GoogleButton } from "./google-button";

// The account theme reads the colour-scheme preference, which jsdom does not provide.
beforeAll(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => {
  cleanup();
  social.mockClear();
});

describe("Continue with Google button", () => {
  it("starts the Google flow with an account landing page and a sign-in error page", () => {
    render(<GoogleButton />);
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );
    expect(social).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/account",
      errorCallbackURL: "/sign-in?provider=google",
    });
  });

  it("shows Google's own G mark as a decorative image beside the text", () => {
    render(<GoogleButton />);
    const button = screen.getByRole("button", { name: "Continue with Google" });
    const mark = button.querySelector("img");
    expect(mark?.getAttribute("src")).toBe("/brand/google-g.png");
    expect(mark?.getAttribute("alt")).toBe("");
  });
});

describe("Google on the account pages", () => {
  it.each(["sign-in", "sign-up"] as const)(
    "puts the button above the email form on %s when Google is configured",
    (mode) => {
      const { container } = render(<AuthForm mode={mode} googleEnabled />);
      const button = screen.getByRole("button", {
        name: "Continue with Google",
      });
      const form = container.querySelector("form")!;
      expect(
        button.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    },
  );

  it.each(["sign-in", "sign-up"] as const)(
    "hides the button on %s when Google is not configured",
    (mode) => {
      render(<AuthForm mode={mode} />);
      expect(screen.queryByText("Continue with Google")).toBeNull();
    },
  );

  it("never offers Google on password recovery pages", () => {
    render(<AuthForm mode="forgot-password" googleEnabled />);
    expect(screen.queryByText("Continue with Google")).toBeNull();
  });

  it("explains a failed Google return on the sign-in page", () => {
    render(
      <AuthForm
        mode="sign-in"
        googleEnabled
        googleError="account_not_linked"
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("not verified");
  });
});
