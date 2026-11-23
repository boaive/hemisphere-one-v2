/** Quick feasibility check: does headless Chrome get a hardware WebGL2 context, and how fast is a heavy draw? */
import { launch } from './cdp.mjs';

const chrome = await launch({ width: 1920, height: 1080 });
try {
  await chrome.navigate('data:text/html,<canvas id=c width=1920 height=1080></canvas>');
  const info = await chrome.evaluate(`(async () => {
    const gl = document.getElementById('c').getContext('webgl2', { preserveDrawingBuffer: true });
    if (!gl) return { ok: false };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const floatRT = !!gl.getExtension('EXT_color_buffer_float');
    // fill-rate probe: 200 full-screen clears + reads
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) { gl.clearColor(i / 200, 0.5, 0.2, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    const px = new Uint8Array(1920 * 1080 * 4);
    gl.readPixels(0, 0, 1920, 1080, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const t1 = performance.now();
    const t2 = performance.now();
    for (let i = 0; i < 10; i++) gl.readPixels(0, 0, 1920, 1080, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const t3 = performance.now();
    return { ok: true, renderer, floatRT, maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE), clearsMs: +(t1 - t0).toFixed(1), readPixelsMs: +((t3 - t2) / 10).toFixed(1) };
  })()`);
  console.log(JSON.stringify(info, null, 2));
} finally {
  await chrome.close();
}
