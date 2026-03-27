import { ZodError } from 'zod';

export class UserFacingError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}

export function formatCliError(error: unknown): string {
  if (error instanceof UserFacingError) {
    return error.message;
  }

  if (error instanceof ZodError) {
    const issues = error.issues
      .map((issue) => {
        const location = issue.path.length > 0 ? issue.path.join('.') : 'config';
        return `- ${location}: ${issue.message}`;
      })
      .join('\n');

    return ['Invalid docplaybook config.', issues].filter(Boolean).join('\n');
  }

  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}
