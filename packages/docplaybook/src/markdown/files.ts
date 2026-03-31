export const SUPPORTED_MARKDOWN_EXTENSIONS = ['.mdx', '.md'] as const;

export type SupportedMarkdownExtension = (typeof SUPPORTED_MARKDOWN_EXTENSIONS)[number];

export function getSupportedMarkdownExtension(relativePath: string): SupportedMarkdownExtension | null {
  for (const extension of SUPPORTED_MARKDOWN_EXTENSIONS) {
    if (relativePath.endsWith(extension)) {
      return extension;
    }
  }

  return null;
}

export function isSupportedMarkdownPath(relativePath: string): boolean {
  return getSupportedMarkdownExtension(relativePath) !== null;
}

export function stripSupportedMarkdownExtension(relativePath: string): string {
  const extension = getSupportedMarkdownExtension(relativePath);
  return extension ? relativePath.slice(0, -extension.length) : relativePath;
}
