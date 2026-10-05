import { describe, it, expect } from "vitest";
import { readEditableText } from "../src/plainText";
// These trees are captured Chromium plaintext-only DOM, not renderer output.
const text = (textContent: string) =>
  ({ nodeType: 3, textContent, childNodes: [] }) as unknown as Node;
const element = (tagName: string, ...childNodes: Node[]) =>
  ({ nodeType: 1, tagName, childNodes }) as unknown as Node;
const br = () => element("BR");
describe("native plaintext serialization", () => {
  it.each([
    [
      element(
        "DIV",
        text("small voice"),
        element("DIV", text("  keep this space")),
        element("DIV", br()),
        element("DIV", text("and this silence.")),
      ),
      "small voice\n  keep this space\n\nand this silence.",
    ],
    [
      element(
        "DIV",
        text("a"),
        element("DIV", br()),
        element("DIV", br()),
        element("DIV", text("b")),
      ),
      "a\n\n\nb",
    ],
    [
      element("DIV", br(), element("DIV", text("a")), element("DIV", br())),
      "\na\n",
    ],
    [
      element(
        "DIV",
        element("DIV", text("a")),
        element("DIV", br()),
        element("DIV", br()),
      ),
      "a\n\n",
    ],
    [element("DIV", text("a"), br(), br()), "a\n"],
    [
      element("DIV", text("lower case\n  exact spaces\n\n")),
      "lower case\n  exact spaces\n\n",
    ],
    [element("DIV", br()), ""],
  ])("preserves recorded line structure %#", (node, expected) =>
    expect(readEditableText(node as Node)).toBe(expected),
  );
});
