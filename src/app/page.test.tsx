import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import Home from "./page";

describe("Home", () => {
  it("renders the Hebrew heading", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "צעד קטן ביום" })).toBeInTheDocument();
  });
});
