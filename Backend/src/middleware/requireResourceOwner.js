import { ApiError } from "../utils/apiError.js";

/**
 * Ownership middleware factory. Resolves the owning user_id of a resource
 * via a caller-supplied loader, then enforces that req.user.sub matches.
 * Admins bypass the check by default; pass { allowAdmin: false } if a
 * given route must be owner-only even for admins.
 *
 * Usage:
 *   router.get(
 *     "/cases/:caseId",
 *     authenticate,
 *     requireResourceOwner({
 *       loadOwnerId: (req) => caseService.getOwnerId(req.params.caseId),
 *     }),
 *     asyncHandler(getCase)
 *   );
 *
 * The loader receives the request and returns either the owner's user_id
 * (UUID string) or null if the resource does not exist. Returning null
 * surfaces as 404; a mismatched owner surfaces as 403.
 */
export function requireResourceOwner({ loadOwnerId, allowAdmin = true }) {
  if (typeof loadOwnerId !== "function") {
    throw new Error("requireResourceOwner: loadOwnerId must be a function");
  }

  return async (req, _res, next) => {
    try {
      if (!req.user) {
        return next(new ApiError(401, "Authentication required"));
      }

      if (allowAdmin && req.user.role === "admin") {
        return next();
      }

      const ownerId = await loadOwnerId(req);

      if (ownerId === null || ownerId === undefined) {
        return next(new ApiError(404, "Resource not found"));
      }

      if (ownerId !== req.user.sub) {
        return next(new ApiError(403, "Access denied"));
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
