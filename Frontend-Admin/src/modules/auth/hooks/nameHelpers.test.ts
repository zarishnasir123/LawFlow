import { describe, it, expect } from "vitest";
import { displayFullName, avatarInitial, type CurrentUser } from "./useCurrentUser";

const user = (over: Partial<CurrentUser> = {}): CurrentUser =>
  ({
    id: "u1",
    firstName: "Zarish",
    lastName: "Nasir",
    email: "zarish@gmail.com",
    phone: null,
    cnic: null,
    role: "admin",
    createdAt: "",
    ...over,
  }) as CurrentUser;

describe("displayFullName", () => {
  it("joins first and last name", () => {
    expect(displayFullName(user())).toBe("Zarish Nasir");
  });

  it("uses whichever single name exists", () => {
    expect(displayFullName(user({ lastName: null }))).toBe("Zarish");
    expect(displayFullName(user({ firstName: null }))).toBe("Nasir");
  });

  it("derives a Title-Cased name from the email handle when no name is set", () => {
    expect(
      displayFullName(user({ firstName: null, lastName: null, email: "zarish.nasir@gmail.com" }))
    ).toBe("Zarish Nasir");
  });

  it("returns empty string for a nullish user", () => {
    expect(displayFullName(null)).toBe("");
    expect(displayFullName(undefined)).toBe("");
  });
});

describe("avatarInitial", () => {
  it("is the first letter of the display name, uppercased", () => {
    expect(avatarInitial(user())).toBe("Z");
  });

  it('defaults to "A" when there is no user', () => {
    expect(avatarInitial(null)).toBe("A");
  });
});
