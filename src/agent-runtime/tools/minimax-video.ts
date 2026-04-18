/**
 * MiniMax 视频生成工具
 * - generate_video: 视频生成（异步，轮询直到完成）
 * - query_video_task: 查询视频任务状态
 */
import { registerTool } from './executor.js';
import { getMinimaxApiKey, getOpenAIApiKey } from '../../services/settings-cache.js';

export function registerTools(): void {
  /**
   * MiniMax 视频生成（异步，需轮询）
   * POST https://api.minimaxi.com/v1/video_generation
   *
   * 模型: MiniMax-Hailuo-2.3 (默认) / MiniMax-Hailuo-02 / S2V-01 / I2V-01 等
   * 支持: 文生视频(T2V) / 图生视频(I2V) / 首尾帧插值(S2V)
   * 注意: 此工具会轮询直到完成，最长等待 5 分钟
   */
  registerTool('generate_video', async (args) => {
    const apiKey = getMinimaxApiKey();
    if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

    const {
      prompt,
      model,
      first_frame_image,
      last_frame_image,
      subject_image,
    } = args as {
      prompt: string;
      model?: string;
      first_frame_image?: string;
      last_frame_image?: string;
      subject_image?: string;
    };

    if (!prompt) throw new Error('prompt is required');

    let actualModel = model || 'MiniMax-Hailuo-2.3';
    if (!model) {
      if (last_frame_image) actualModel = 'MiniMax-Hailuo-02';
      else if (subject_image) actualModel = 'S2V-01';
    }

    const body: Record<string, unknown> = {
      model: actualModel,
      prompt,
    };

    if (first_frame_image) body.first_frame_image = first_frame_image;
    if (last_frame_image) body.last_frame_image = last_frame_image;
    if (subject_image) {
      body.subject_reference = [{ type: 'character', image: [subject_image] }];
    }

    // 1. 创建任务
    const createRes = await fetch('https://api.minimaxi.com/v1/video_generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`MiniMax video generation error: ${createRes.status} ${err}`);
    }

    const createData = await createRes.json() as {
      task_id?: string;
      status?: string;
      base_resp?: { status_code: number; status_msg: string };
    };

    if (createData.base_resp && createData.base_resp.status_code !== 0) {
      throw new Error(`MiniMax video task creation failed: ${createData.base_resp.status_code} ${createData.base_resp.status_msg}`);
    }

    const taskId = createData.task_id;
    if (!taskId) throw new Error('No task_id returned');

    // 2. 轮询直到完成
    const maxWaitMs = 5 * 60 * 1000;
    const pollIntervalMs = 5000;
    const deadline = Date.now() + maxWaitMs;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, pollIntervalMs));

      const statusRes = await fetch(
        `https://api.minimaxi.com/v1/query/video_generation?task_id=${taskId}`,
        { headers: { 'Authorization': `Bearer ${apiKey}` } }
      );

      if (!statusRes.ok) {
        const err = await statusRes.text();
        throw new Error(`MiniMax video status error: ${statusRes.status} ${err}`);
      }

      const statusData = await statusRes.json() as {
        status?: string;
        file_id?: string;
        video_url?: string;
        base_resp?: { status_code: number; status_msg: string };
      };

      if (statusData.status === 'success' && statusData.file_id) {
        const fileRes = await fetch(
          `https://api.minimaxi.com/v1/files/retrieve?file_id=${statusData.file_id}`,
          { headers: { 'Authorization': `Bearer ${apiKey}` } }
        );

        if (fileRes.ok) {
          const fileData = await fileRes.json() as {
            file?: { download_url?: string };
          };
          return {
            task_id: taskId,
            status: 'success',
            video_url: fileData.file?.download_url || '',
          };
        }
        return {
          task_id: taskId,
          status: 'success',
          file_id: statusData.file_id,
        };
      }

      if (statusData.status === 'fail' || statusData.status === 'failed') {
        throw new Error(`MiniMax video generation failed: ${statusData.base_resp?.status_msg || statusData.status}`);
      }
    }

    throw new Error(`Video generation timed out after 5 minutes. task_id: ${taskId}`);
  });

  /**
   * MiniMax 查询视频任务状态
   * GET https://api.minimaxi.com/v1/query/video_generation?task_id=xxx
   */
  registerTool('query_video_task', async (args) => {
    const apiKey = getMinimaxApiKey();
    if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

    const { task_id } = args as { task_id: string };
    if (!task_id) throw new Error('task_id is required');

    const res = await fetch(
      `https://api.minimaxi.com/v1/query/video_generation?task_id=${task_id}`,
      { headers: { 'Authorization': `Bearer ${apiKey}` } }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`MiniMax video status error: ${res.status} ${err}`);
    }

    const data = await res.json() as {
      task_id?: string;
      status?: string;
      file_id?: string;
      video_url?: string;
      base_resp?: { status_code: number; status_msg: string };
    };

    if (data.base_resp && data.base_resp.status_code !== 0) {
      throw new Error(`MiniMax video query failed: ${data.base_resp.status_code} ${data.base_resp.status_msg}`);
    }

    if (data.status === 'success' && data.file_id) {
      const fileRes = await fetch(
        `https://api.minimaxi.com/v1/files/retrieve?file_id=${data.file_id}`,
        { headers: { 'Authorization': `Bearer ${apiKey}` } }
      );
      if (fileRes.ok) {
        const fileData = await fileRes.json() as {
          file?: { download_url?: string };
        };
        return {
          task_id: data.task_id,
          status: 'success',
          video_url: fileData.file?.download_url || '',
          file_id: data.file_id,
        };
      }
      return { task_id: task_id, status: data.status, file_id: data.file_id };
    }

    return { task_id: task_id, status: data.status };
  });
}
