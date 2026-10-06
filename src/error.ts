/**
 * Transport-level failure (network down, DNS, timeout). A thrown
 * LieferandoError (reason "network") means we could not reach the CDN;
 * a null return always means the platform answered: absent (unknown
 * slug — the CDN serves S3-style 404 XML for those).
 */
export type LieferandoFailureReason = "network";

export class LieferandoError extends Error {
  constructor(readonly reason: LieferandoFailureReason, message: string) {
    super(message);
    this.name = "LieferandoError";
  }
}

export function isTransportFailure(error: unknown): boolean {
  return error instanceof Error || typeof DOMException === "function" && error instanceof DOMException;
}
