import { ContentMetadata } from './types';

/**
 * Parse YAML-like frontmatter from markdown content.
 * Supports both formats:
 *   key: value
 *   key: [val1, val2]
 *   key:
 *     - item1
 *     - item2
 */
export function parseFrontmatter(content: string): { metadata: ContentMetadata; content: string } {
  const lines = content.split('\n');
  const metadata: ContentMetadata = {};
  let contentStart = 0;
  
  if (lines[0]?.trim() === '---') {
    let currentKey: string | null = null;
    let currentArray: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim() === '---') {
        contentStart = i + 1;
        break;
      }

      // Detect dashed list item (indented with `- `)
      const listMatch = lines[i].match(/^\s+-\s+(.+)$/);
      if (listMatch && currentKey) {
        currentArray.push(listMatch[1].trim());
        continue;
      }

      // If we were building an array, flush it
      if (currentKey && currentArray.length > 0) {
        metadata[currentKey] = [...currentArray];
        currentArray = [];
        currentKey = null;
      }

      const colonIdx = lines[i].indexOf(':');
      if (colonIdx > 0) {
        const key = lines[i].slice(0, colonIdx).trim();
        let value = lines[i].slice(colonIdx + 1).trim();

        if (value === '') {
          // List follows — set current key for accumulation
          currentKey = key;
          currentArray = [];
        } else if (value.startsWith('[') && value.endsWith(']')) {
          value = value.slice(1, -1);
          metadata[key] = value.split(',').map(v => v.trim());
        } else {
          metadata[key] = value;
        }
      }
    }

    // Flush any remaining array
    if (currentKey && currentArray.length > 0) {
      metadata[currentKey] = [...currentArray];
    }
  }

  return {
    metadata,
    content: lines.slice(contentStart).join('\n').trim()
  };
}

export function stringifyFrontmatter(metadata: ContentMetadata): string {
  const lines: string[] = ['---'];
  
  for (const [key, value] of Object.entries(metadata)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
    } else if (value !== undefined) {
      lines.push(`${key}: ${value}`);
    }
  }
  
  lines.push('---');
  return lines.join('\n');
}
