// Browser lifecycle is separated from the HUD so failure cleanup can be tested.
export async function startRecording({ canvas, send, Recorder = MediaRecorder, id = crypto.randomUUID(), onError = console.error, onFinish = () => {} }) {
  let recorder, uploads = Promise.resolve(), failure, finishing = false, reserved = false;
  async function finish() {
    if (finishing) return;
    finishing = true;
    try {
      await uploads;
      await send(`/recording/${failure ? 'abort' : 'done'}?id=${id}`);
    } catch (error) {
      failure ||= error;
      try { await send(`/recording/abort?id=${id}`); } catch { /* A disconnected server cannot acknowledge cleanup. */ }
    } finally { if (failure) onError(failure); onFinish(); }
  }
  try {
    recorder = new Recorder(canvas.captureStream(12), { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 800000 });
    recorder.ondataavailable = e => {
      if (e.data.size) uploads = uploads.then(async () => {
        if (!failure) await send('/recording?id=' + id, new Blob([e.data]));
      }).catch(error => { failure = error; if (recorder.state === 'recording') recorder.stop(); });
    };
    recorder.onstop = finish;
    recorder.onerror = event => { failure = event.error || Error('MediaRecorder failed'); if (recorder.state === 'recording') recorder.stop(); else void finish(); };
    await send('/recording/start?id=' + id); reserved = true;
    recorder.start(2000);
    await send('/recording/ready?id=' + id);
    return recorder;
  } catch (error) {
    failure = error;
    // Do not let an onstop callback race a successful /done after failed startup.
    if (recorder) { recorder.onstop = null; if (recorder.state === 'recording') recorder.stop(); }
    if (reserved) { try { await send('/recording/abort?id=' + id); } catch {} }
    throw error;
  }
}
