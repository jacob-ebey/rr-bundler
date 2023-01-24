export class KnownError extends Error {
  /**
   *
   * @param {string} message
   * @param {{
   *   cause?: Error;
   *   location?: Partial<esbuild.Location>
   * }} args
   */
  constructor(message, args) {
    super(message, { cause: args ? args.cause : undefined });
    this.name = "KnownError";
    this.location = args ? args.location : undefined;
  }
}
