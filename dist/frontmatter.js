export function parseFrontmatter(content) {
    const lines = content.split('\n');
    const metadata = {};
    let contentStart = 0;
    if (lines[0]?.trim() === '---') {
        for (let i = 1; i < lines.length; i++) {
            if (lines[i]?.trim() === '---') {
                contentStart = i + 1;
                break;
            }
            const colonIdx = lines[i].indexOf(':');
            if (colonIdx > 0) {
                const key = lines[i].slice(0, colonIdx).trim();
                let value = lines[i].slice(colonIdx + 1).trim();
                if (value.startsWith('[') && value.endsWith(']')) {
                    value = value.slice(1, -1);
                    metadata[key] = value.split(',').map(v => v.trim());
                }
                else {
                    metadata[key] = value;
                }
            }
        }
    }
    return {
        metadata,
        content: lines.slice(contentStart).join('\n').trim()
    };
}
export function stringifyFrontmatter(metadata) {
    const lines = ['---'];
    for (const [key, value] of Object.entries(metadata)) {
        if (Array.isArray(value)) {
            lines.push(`${key}: [${value.join(', ')}]`);
        }
        else if (value !== undefined) {
            lines.push(`${key}: ${value}`);
        }
    }
    lines.push('---');
    return lines.join('\n');
}
