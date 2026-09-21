package local.agentview;
import java.nio.*;import java.nio.file.*;import java.io.*;import java.awt.image.BufferedImage;import javax.imageio.ImageIO;import java.util.concurrent.*;import org.lwjgl.glfw.GLFW;import org.lwjgl.opengl.GL11;import org.lwjgl.opengl.GL30;import org.lwjgl.system.MemoryUtil;
public class FrameCapture {
 static long last=0,lastPreview=0,lastHeartbeat=0,lastPoll=0,startNanos=0,frames=0;static ByteBuffer pixels;static int width,height;static volatile boolean busy=false;static String requested="",recording="";static Process encoder;static OutputStream pipe;
 static final Path root=Paths.get(System.getProperty("agent.captureDir"));
 static final ExecutorService writer=Executors.newSingleThreadExecutor(r->{Thread t=new Thread(r,"native-frame-writer");t.setDaemon(true);return t;});
 static void finish(){try{if(pipe!=null){pipe.close();encoder.waitFor(30,TimeUnit.SECONDS);Files.writeString(Paths.get(recording+".finished.json"),"{\"time\":\""+java.time.Instant.now()+"\",\"frames\":"+frames+",\"fps\":20,\"exitCode\":"+encoder.exitValue()+"}");}}catch(Exception e){e.printStackTrace();}finally{pipe=null;encoder=null;recording="";}}
 public static void resourcesReady(){try{Files.writeString(root.resolve("resources-ready.txt"),java.time.Instant.now().toString());}catch(Exception e){e.printStackTrace();}}
 public static void frame(long window){
  local.agentview.NativeUi.tick();
  long now=System.nanoTime();
  if(now-lastPoll>500_000_000L){lastPoll=now;try{Path control=root.resolve("record-path.txt");requested=Files.exists(control)?Files.readString(control).trim():"";}catch(Exception e){requested="";}}
  if(busy||now-last<(requested.isEmpty()?1_000_000_000L:45_000_000L))return;last=now;
  try{
   int[] vp=new int[4];GL11.glGetIntegerv(GL11.GL_VIEWPORT,vp);int w=vp[2],h=vp[3];if(w<1||h<1)return;
   if(pixels==null||width!=w||height!=h){if(pixels!=null)MemoryUtil.memFree(pixels);width=w;height=h;pixels=MemoryUtil.memAlloc(width*height*4);}
   int oldFramebuffer=GL11.glGetInteger(GL30.GL_READ_FRAMEBUFFER_BINDING);GL30.glBindFramebuffer(GL30.GL_READ_FRAMEBUFFER,0);GL11.glReadBuffer(GL11.GL_BACK);pixels.clear();GL11.glReadPixels(0,0,width,height,GL11.GL_RGBA,GL11.GL_UNSIGNED_BYTE,pixels);GL30.glBindFramebuffer(GL30.GL_READ_FRAMEBUFFER,oldFramebuffer);
   byte[] data=new byte[width*height*4];pixels.get(data);int ww=width,hh=height;String want=requested;boolean preview=now-lastPreview>2_000_000_000L;if(preview)lastPreview=now;busy=true;
   writer.submit(()->{try{
    if(!want.equals(recording)){finish();if(!want.isEmpty()){recording=want;Files.createDirectories(Paths.get(want).getParent());encoder=new ProcessBuilder(System.getProperty("agent.ffmpeg", "ffmpeg"),"-y","-f","rawvideo","-pixel_format","rgba","-video_size","960x540","-framerate","20","-i","pipe:0","-vf","vflip","-an","-c:v","libx264","-preset","veryfast","-crf","29","-maxrate","1600k","-bufsize","3200k","-pix_fmt","yuv420p","-movflags","+faststart",want).redirectError(new File(want+".encoder.log")).redirectOutput(ProcessBuilder.Redirect.DISCARD).start();pipe=encoder.getOutputStream();startNanos=now;frames=0;Files.writeString(Paths.get(want+".started.json"),"{\"time\":\""+java.time.Instant.now()+"\",\"width\":960,\"height\":540,\"fps\":20}");}}
    if(pipe!=null){byte[] frame=data;if(ww!=960||hh!=540){frame=new byte[960*540*4];for(int y=0;y<540;y++)for(int x=0;x<960;x++){int src=((y*hh/540)*ww+x*ww/960)*4,dst=(y*960+x)*4;frame[dst]=data[src];frame[dst+1]=data[src+1];frame[dst+2]=data[src+2];frame[dst+3]=data[src+3];}}long due=(now-startNanos)/50_000_000L+1;while(frames<due){pipe.write(frame);frames++;}}
    if(pipe!=null&&now-lastHeartbeat>1_000_000_000L){lastHeartbeat=now;Path dest=root.resolve("capture-heartbeat.json"),temp=root.resolve("capture-heartbeat.tmp.json");Files.writeString(temp,"{\"time\":"+System.currentTimeMillis()+",\"frames\":"+frames+",\"encoderAlive\":"+encoder.isAlive()+"}");Files.move(temp,dest,StandardCopyOption.REPLACE_EXISTING);}
    if(preview){BufferedImage image=new BufferedImage(ww,hh,BufferedImage.TYPE_INT_RGB);int[] rgb=new int[ww*hh];for(int y=0;y<hh;y++)for(int x=0;x<ww;x++){int i=((hh-1-y)*ww+x)*4;rgb[y*ww+x]=((data[i]&255)<<16)|((data[i+1]&255)<<8)|(data[i+2]&255);}image.setRGB(0,0,ww,hh,rgb,0,ww);Path dest=root.resolve("native-preview.png"),temp=root.resolve("native-preview.tmp.png");ImageIO.write(image,"png",temp.toFile());Files.move(temp,dest,StandardCopyOption.REPLACE_EXISTING);}
   }catch(Exception e){e.printStackTrace();finish();}finally{busy=false;}});
  }catch(Throwable e){e.printStackTrace();}
 }
}
