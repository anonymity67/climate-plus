declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    AQUAVELLE_AUTH_MODE?: string;
    AQUAVELLE_ACCESS_ISSUER?: string;
    AQUAVELLE_ACCESS_AUDIENCE?: string;
    AQUAVELLE_OPERATOR_ORIGIN?: string;
  }
}
