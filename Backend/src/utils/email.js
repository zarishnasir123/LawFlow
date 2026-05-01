import { Resolver } from "dns/promises";

const reservedEmailDomains = new Set([
  "example.com",
  "example.net",
  "example.org",
  "localhost"
]);
const mxLookupTimeoutMs = 3000;

export function getEmailDomain(email) {
  return String(email || "").split("@")[1]?.trim().toLowerCase() || "";
}

export function isReservedEmailDomain(email) {
  return reservedEmailDomains.has(getEmailDomain(email));
}

async function resolveMxWithTimeout(domain) {
  const resolver = new Resolver();
  let timeoutId;

  try {
    return await Promise.race([
      resolver.resolveMx(domain),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          if (typeof resolver.cancel === "function") {
            resolver.cancel();
          }

          reject(new Error("MX lookup timed out"));
        }, mxLookupTimeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function canEmailDomainReceiveMail(email) {
  const domain = getEmailDomain(email);

  if (!domain || isReservedEmailDomain(email)) {
    return false;
  }

  try {
    const mxRecords = await resolveMxWithTimeout(domain);
    return mxRecords.length > 0;
  } catch {
    return false;
  }
}
