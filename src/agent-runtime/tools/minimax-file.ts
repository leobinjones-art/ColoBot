/**
 * MiniMax 文件管理工具
 * - upload_file: 文件上传
 * - list_files: 文件列表
 * - retrieve_file: 文件检索
 * - delete_file: 文件删除
 */
import { registerTool } from './executor.js';

export function registerTools(): void {
  /**
   * MiniMax 文件上传
   * POST https://api.minimaxi.com/v1/files/upload
   *
   * purpose: voice_clone / prompt_audio / t2a_async_input / video_generation
   * 支持 mp3, m4a, wav, text, zip, 图片格式
   */
  registerTool('upload_file', async (args) => {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

    const { file_url, file_data, purpose } = args as {
      file_url?: string;
      file_data?: string;
      purpose: string;
    };

    if (!purpose) throw new Error('purpose is required (voice_clone/prompt_audio/t2a_async_input/video_generation)');
    if (!file_url && !file_data) throw new Error('file_url or file_data (base64) is required');

    let fileBuffer: ArrayBuffer;

    if (file_data) {
      const binaryString = atob(file_data.replace(/\s/g, ''));
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      fileBuffer = bytes.buffer;
    } else if (file_url) {
      const res = await fetch(file_url);
      if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);
      fileBuffer = await res.arrayBuffer();
    } else {
      throw new Error('No file source provided');
    }

    const formData = new FormData();
    const blob = new Blob([fileBuffer]);
    formData.append('file', blob, 'file');
    formData.append('purpose', purpose);

    const res = await fetch('https://api.minimaxi.com/v1/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`MiniMax file upload error: ${res.status} ${err}`);
    }

    const data = await res.json() as {
      file?: {
        file_id: string;
        bytes: number;
        created_at: number;
        filename: string;
        purpose: string;
      };
      base_resp?: { status_code: number; status_msg: string };
    };

    if (data.base_resp && data.base_resp.status_code !== 0) {
      throw new Error(`MiniMax file upload failed: ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
    }

    return {
      file_id: data.file?.file_id,
      bytes: data.file?.bytes,
      filename: data.file?.filename,
      purpose: data.file?.purpose,
      created_at: data.file?.created_at,
    };
  });

  /**
   * MiniMax 文件列表
   * GET https://api.minimaxi.com/v1/files/list?purpose=xxx
   *
   * purpose: voice_clone / prompt_audio / t2a_async_input
   */
  registerTool('list_files', async (args) => {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

    const { purpose } = args as { purpose?: string };

    const url = purpose
      ? `https://api.minimaxi.com/v1/files/list?purpose=${encodeURIComponent(purpose)}`
      : 'https://api.minimaxi.com/v1/files/list';

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`MiniMax file list error: ${res.status} ${err}`);
    }

    const data = await res.json() as {
      files?: Array<{
        file_id: string;
        bytes: number;
        created_at: number;
        filename: string;
        purpose: string;
      }>;
      base_resp?: { status_code: number; status_msg: string };
    };

    if (data.base_resp && data.base_resp.status_code !== 0) {
      throw new Error(`MiniMax file list failed: ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
    }

    return {
      files: (data.files ?? []).map(f => ({
        file_id: f.file_id,
        bytes: f.bytes,
        filename: f.filename,
        purpose: f.purpose,
        created_at: new Date(f.created_at * 1000).toISOString(),
      })),
    };
  });

  /**
   * MiniMax 文件检索（查询文件信息 + 下载链接）
   * GET https://api.minimaxi.com/v1/files/retrieve?file_id=xxx
   */
  registerTool('retrieve_file', async (args) => {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

    const { file_id } = args as { file_id: string };
    if (!file_id) throw new Error('file_id is required');

    const res = await fetch(
      `https://api.minimaxi.com/v1/files/retrieve?file_id=${encodeURIComponent(file_id)}`,
      { headers: { 'Authorization': `Bearer ${apiKey}` } }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`MiniMax file retrieve error: ${res.status} ${err}`);
    }

    const data = await res.json() as {
      file?: {
        file_id: string;
        bytes: number;
        created_at: number;
        filename: string;
        purpose: string;
        download_url?: string;
      };
      base_resp?: { status_code: number; status_msg: string };
    };

    if (data.base_resp && data.base_resp.status_code !== 0) {
      throw new Error(`MiniMax file retrieve failed: ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
    }

    return {
      file_id: data.file?.file_id,
      bytes: data.file?.bytes,
      filename: data.file?.filename,
      purpose: data.file?.purpose,
      download_url: data.file?.download_url,
      created_at: data.file?.created_at
        ? new Date(data.file.created_at * 1000).toISOString()
        : undefined,
    };
  });

  /**
   * MiniMax 文件删除
   * POST https://api.minimaxi.com/v1/files/delete
   *
   * purpose: voice_clone / prompt_audio / t2a_async / t2a_async_input / video_generation
   */
  registerTool('delete_file', async (args) => {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

    const { file_id, purpose } = args as { file_id: string; purpose: string };
    if (!file_id) throw new Error('file_id is required');
    if (!purpose) throw new Error('purpose is required');

    const res = await fetch('https://api.minimaxi.com/v1/files/delete', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file_id, purpose }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`MiniMax file delete error: ${res.status} ${err}`);
    }

    const data = await res.json() as {
      file_id?: string;
      base_resp?: { status_code: number; status_msg: string };
    };

    if (data.base_resp && data.base_resp.status_code !== 0) {
      throw new Error(`MiniMax file delete failed: ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
    }

    return { file_id: data.file_id, deleted: true };
  });
}
