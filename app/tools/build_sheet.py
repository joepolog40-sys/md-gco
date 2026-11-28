# Construit la feuille MD générique (sans données) pour l'app et pour la page musiciens.
import subprocess,re,os,sys,json
MD='/home/claude/work/md';APP=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
subprocess.run(['python3','build.py','md_data2.json'],cwd=MD,check=True,capture_output=True)
html=open(MD+'/md2.html').read()
lib=open(MD+'/site/mqtt.min.js').read().replace('</script','<\\/script')
empty=json.dumps({"meta":{"date":""},"songs":[],"rev":0})
html=re.sub(r'(<script id="data"[^>]*>)[\s\S]*?(</script>)',lambda m:m.group(1)+empty+m.group(2),html,count=1)
html=html.replace('<script id="data"','<script data-md>'+lib+'</script>\n<script id="data"',1)
assert 'jo-f8abceb659c1' not in html
os.makedirs(APP+'/renderer',exist_ok=True)
open(APP+'/renderer/sheet.html','w').write(html)
os.makedirs('/home/claude/work/mdapp/live',exist_ok=True)
open('/home/claude/work/mdapp/live/index.html','w').write(html.replace('<title>','<title>Live · ',1))
print('sheet',len(html))
