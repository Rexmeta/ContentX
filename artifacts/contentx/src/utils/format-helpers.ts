import { JsonFormatStatus } from '@workspace/api-client-react';

export async function parseJsonFile(file: File): Promise<unknown> {
  if (file.size > 512 * 1024) {
    throw new Error('파일 크기는 512KB를 초과할 수 없습니다.');
  }
  const text = await file.text();
  return parseJsonString(text);
}

export function parseJsonString(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('유효하지 않은 JSON입니다.');
  }
}

export function downloadJsonBlob(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getStatusLabel(status: JsonFormatStatus): string {
  switch (status) {
    case 'draft': return '초안';
    case 'active': return '활성';
    case 'superseded': return '대체됨';
    default: return status as string;
  }
}
