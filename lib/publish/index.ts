/**
 * The interface, not the network. Everything the app knows about publishing is
 * this shape - which is what makes adding Instagram tomorrow a new file rather
 * than a refactor.
 */
export type PublishResult = { url: string };

export interface Publisher {
  readonly name: string;
  /** True when the server has the credentials this publisher needs. */
  isConfigured(): boolean;
  publish(image: Buffer, text: string): Promise<PublishResult>;
}
