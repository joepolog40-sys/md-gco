import docx,glob,os,re,json,sys,unicodedata
COL={'00BFC6':'intro','92BB32':'couplet','323695':'prerefrain','23852B':'refrain','ED8800':'pont','9AA9A6':'tag','E60000':'fin'}
NAME={'intro':'Intro','couplet':'Couplet','prerefrain':'Pré-refrain','refrain':'Refrain','pont':'Pont','tag':'Tag','fin':'Fin'}
INT={'intro':(2,3),'couplet':(3,4),'prerefrain':(4,5),'refrain':(6,6),'pont':(5,7),'tag':(5,5),'fin':(3,2)}
def slug(t):
  t=unicodedata.normalize('NFKD',t).encode('ascii','ignore').decode().lower();return re.sub(r'[^a-z0-9]+','-',t).strip('-')[:40]
def bars_of(line):
  m=re.search(r'\((\d+)\s*×\)',line);mult=int(m.group(1)) if m else 1
  body=re.sub(r'\(.*?\)','',line);toks=[t for t in body.split() if re.match(r'^[♭b#♯]?[1-7]',t)]
  return max(1,len(toks))*mult
def parse(path):
  d=docx.Document(path);title=key=None
  for t in d.tables:
    for row in t.rows:
      for c in row.cells:
        tx=c.text.strip()
        if not tx:continue
        if re.fullmatch(r'[A-G][#b♭♯]?m?',tx):key=key or tx
        elif not title:title=tx
  lines=[]
  for p in d.paragraphs:
    rs=[r for r in p.runs if r.text.strip()]
    if not rs:continue
    col=None
    for r in rs:
      if r.font.color and r.font.color.type and str(r.font.color.rgb) in COL:col=str(r.font.color.rgb);break
    tx=p.text.strip()
    if not re.search(r'\d',tx) or not col:continue
    lines.append((COL[col],tx))
  secs=[]
  for k,tx in lines:
    if secs and secs[-1]['kind']==k:secs[-1]['nash']+='\n'+tx;secs[-1]['bars']+=bars_of(tx)
    else:secs.append({'kind':k,'nash':tx,'bars':bars_of(tx)})
  out=[];cnt={}
  for i,s in enumerate(secs):
    k=s['kind']
    if k=='intro' and i>0 and i==len(secs)-1:nm='Outro'
    elif k=='intro' and i>0:nm='Instrumental'
    else:nm=NAME[k]
    cnt[nm]=cnt.get(nm,0)+1
    i0,i1=INT[k]
    out.append({'name':nm,'kind':k,'bars':min(32,max(2,s['bars'])),'nash':s['nash'],'i0':i0,'i1':i1,'call':'','cue':'','note':'','mark':'none','t':None})
  return title,key,out
if __name__=='__main__':
  res=[];bad=[]
  for f in sorted(glob.glob(sys.argv[1]+'/*.docx')):
    b=os.path.basename(f)[:-5]
    if b.startswith(('Modèle','Test')):continue
    try:t,k,s=parse(f)
    except Exception as e:bad.append((b,str(e)));continue
    if not s:bad.append((b,'vide'));continue
    res.append({'file':b,'title':t or b,'key':k or '','sections':s})
  json.dump(res,open(sys.argv[2],'w'),ensure_ascii=False,indent=1)
  print(len(res),'ok',bad)
