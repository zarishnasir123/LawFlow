import { describe, it, expect } from "vitest";
import { registrationStrategies } from "../../../../src/modules/auth/registration.strategies.js";

describe("client strategy mapProfileData", () => {
  it("trims and maps address, city, and tehsil", () => {
    expect(
      registrationStrategies.client.mapProfileData({
        address: "  House 5, Gujranwala  ",
        city: " Gujranwala ",
        tehsil: " Kamoke ",
      })
    ).toEqual({ address: "House 5, Gujranwala", city: "Gujranwala", tehsil: "Kamoke" });
  });

  it("turns empty and missing values into null", () => {
    expect(registrationStrategies.client.mapProfileData({ address: "  ", city: "" })).toEqual({
      address: null,
      city: null,
      tehsil: null,
    });
  });
});

describe("googleClient strategy mapProfileData", () => {
  it("splits a two-part full name", () => {
    const mapped = registrationStrategies.googleClient.mapProfileData({
      fullName: "Zarish Nasir",
      email: "z@gmail.com",
    });
    expect(mapped.firstName).toBe("Zarish");
    expect(mapped.lastName).toBe("Nasir");
  });

  it("keeps multi-word last names together", () => {
    const mapped = registrationStrategies.googleClient.mapProfileData({
      fullName: "Zarish Fatima Nasir",
      email: "z@gmail.com",
    });
    expect(mapped.firstName).toBe("Zarish");
    expect(mapped.lastName).toBe("Fatima Nasir");
  });

  it("handles a single-word name with an empty last name", () => {
    const mapped = registrationStrategies.googleClient.mapProfileData({
      fullName: "Zarish",
      email: "z@gmail.com",
    });
    expect(mapped.firstName).toBe("Zarish");
    expect(mapped.lastName).toBe("");
  });

  it("falls back to the email local part when Google sends no name", () => {
    const mapped = registrationStrategies.googleClient.mapProfileData({
      email: "zarish.nasir@gmail.com",
    });
    expect(mapped.firstName).toBe("zarish.nasir");
  });

  it('falls back to "user" when there is neither name nor email', () => {
    expect(registrationStrategies.googleClient.mapProfileData({}).firstName).toBe("user");
  });

  it("leaves location fields null (OAuth signup has no address step)", () => {
    const mapped = registrationStrategies.googleClient.mapProfileData({
      fullName: "A B",
      email: "a@b.com",
    });
    expect(mapped.address).toBeNull();
    expect(mapped.city).toBeNull();
    expect(mapped.tehsil).toBeNull();
  });
});

describe("lawyer strategy mapProfileData", () => {
  it("lowercases the specialization", () => {
    expect(registrationStrategies.lawyer.mapProfileData({ specialization: "Civil" }).specialization).toBe("civil");
  });

  it("accepts camelCase and snake_case field names", () => {
    expect(
      registrationStrategies.lawyer.mapProfileData({ districtBar: "Gujranwala Bar" }).districtBar
    ).toBe("Gujranwala Bar");
    expect(
      registrationStrategies.lawyer.mapProfileData({ district_bar: "Gujranwala Bar" }).districtBar
    ).toBe("Gujranwala Bar");
  });

  it("coerces experience years to a number, defaulting to 0", () => {
    expect(registrationStrategies.lawyer.mapProfileData({ experienceYears: "7" }).experienceYears).toBe(7);
    expect(registrationStrategies.lawyer.mapProfileData({}).experienceYears).toBe(0);
    expect(registrationStrategies.lawyer.mapProfileData({ experienceYears: "lots" }).experienceYears).toBe(0);
  });

  it("maps an uploaded document object including snake_case keys and numeric size", () => {
    const mapped = registrationStrategies.lawyer.mapProfileData({
      degreeDocument: {
        storage_bucket: "lawyer-docs",
        storage_path: "lawyers/k1/degree.pdf",
        file_name: "degree.pdf",
        mime_type: "application/pdf",
        file_size: "245760",
      },
    });
    expect(mapped.degreeDocument).toEqual({
      storageBucket: "lawyer-docs",
      storagePath: "lawyers/k1/degree.pdf",
      fileName: "degree.pdf",
      mimeType: "application/pdf",
      fileSize: 245760,
    });
  });

  it("falls back to an external-reference URL when no document object is given", () => {
    const mapped = registrationStrategies.lawyer.mapProfileData({
      lawDegreeDocUrl: "https://old-storage.example/degree.pdf",
    });
    expect(mapped.degreeDocument).toMatchObject({
      storageBucket: "external-reference",
      storagePath: "https://old-storage.example/degree.pdf",
    });
  });

  it("returns null documents when neither object nor URL exists", () => {
    const mapped = registrationStrategies.lawyer.mapProfileData({});
    expect(mapped.degreeDocument).toBeNull();
    expect(mapped.licenseCardFrontImage).toBeNull();
    expect(mapped.licenseCardBackImage).toBeNull();
  });
});
