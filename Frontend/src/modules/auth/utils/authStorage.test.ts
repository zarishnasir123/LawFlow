import { describe, it, expect, beforeEach } from "vitest";
import {
  getInMemoryAccessToken,
  setInMemoryAccessToken,
  getStoredAuthUser,
  saveStoredAuthUser,
  clearStoredAuth,
  type StoredAuthUser,
} from "./authStorage";

const user: StoredAuthUser = { id: "u1", email: "a@b.com", role: "client" };

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  setInMemoryAccessToken(null);
});

describe("in-memory access token", () => {
  it("stores and returns the token (never in web storage)", () => {
    setInMemoryAccessToken("abc.def.ghi");
    expect(getInMemoryAccessToken()).toBe("abc.def.ghi");
    expect(localStorage.getItem("user")).toBeNull();
  });
});

describe("saveStoredAuthUser / getStoredAuthUser", () => {
  it("uses localStorage when rememberMe is true", () => {
    saveStoredAuthUser(user, true, "token1");
    expect(localStorage.getItem("user")).toBeTruthy();
    expect(sessionStorage.getItem("user")).toBeNull();
    expect(getStoredAuthUser()?.email).toBe("a@b.com");
    expect(getInMemoryAccessToken()).toBe("token1");
  });

  it("uses sessionStorage when rememberMe is false", () => {
    saveStoredAuthUser(user, false);
    expect(sessionStorage.getItem("user")).toBeTruthy();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("never leaves the user in both storages at once", () => {
    saveStoredAuthUser(user, true, "t");
    saveStoredAuthUser(user, false);
    expect(localStorage.getItem("user")).toBeNull();
    expect(sessionStorage.getItem("user")).toBeTruthy();
  });

  it("persists the rememberMe flag onto the stored user", () => {
    saveStoredAuthUser(user, true, "t");
    expect(getStoredAuthUser()?.rememberMe).toBe(true);
  });
});

describe("getStoredAuthUser resilience", () => {
  it("returns null when nothing is stored", () => {
    expect(getStoredAuthUser()).toBeNull();
  });

  it("returns null for corrupt JSON instead of throwing", () => {
    localStorage.setItem("user", "{not json");
    expect(getStoredAuthUser()).toBeNull();
  });
});

describe("clearStoredAuth", () => {
  it("wipes both storages and the in-memory token", () => {
    saveStoredAuthUser(user, true, "token1");
    clearStoredAuth();
    expect(getStoredAuthUser()).toBeNull();
    expect(getInMemoryAccessToken()).toBeNull();
  });
});
