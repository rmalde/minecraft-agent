import pathlib,json,subprocess,os,sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent.parent/'scripts'))
from runtime import executable
root=pathlib.Path(__file__).resolve().parent
(root/'resources-ready.txt').unlink(missing_ok=True)
config=json.load(open(root/'config.json'));game=root/'game';game.mkdir(exist_ok=True)
(game/'options.txt').write_text('fullscreen:false\noverrideWidth:960\noverrideHeight:540\nrenderDistance:8\nmaxFps:40\nguiScale:4\nviewBobbing:true\npauseOnLostFocus:false\ntutorialStep:none\ngamma:1.0\nadvancedItemTooltips:false\nsoundCategory_master:0.0\n')
java=executable('java')
ffmpeg=os.environ.get('FFMPEG') or executable('ffmpeg')
args=[str(java),'-javaagent:'+str(root/'native-view-agent.jar'),'-XstartOnFirstThread','-Djava.awt.headless=true','-Dagent.ffmpeg='+ffmpeg,'-Dagent.mirrorPort='+os.environ.get('NATIVE_MIRROR_PORT','25578'),'-Dagent.captureDir='+str(root),'-Xmx1G','-Dorg.lwjgl.librarypath='+config['natives'],'-Djava.library.path='+config['natives'],'--add-opens=java.base/java.lang=ALL-UNNAMED','-cp',(root/'classpath.txt').read_text(),config['mainClass'],'--username','AgentView','--version','1.16.5','--gameDir',str(game),'--assetsDir',str(root/'assets'),'--assetIndex',config['assetIndex'],'--uuid','00000000000000000000000000000001','--accessToken','0','--userType','legacy','--width','960','--height','540','--server','127.0.0.1','--port',os.environ.get('NATIVE_MIRROR_PORT','25578')]
os.execv(args[0],args)
