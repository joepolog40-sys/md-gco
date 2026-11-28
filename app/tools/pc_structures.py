# Applique les structures Planning Center (séquence de l'arrangement) aux chants de la bibliothèque.
# Grilles : celles de la fiche de Jo (par type de section) ; sinon celles de la grille Planning Center.
import json,re,copy,sys
LIBF=sys.argv[1] if len(sys.argv)>1 else 'default/bibliotheque.json'
EXF='default/setlist-exemple.json'
lib=json.load(open(LIBF));MAP=json.load(open('/tmp/pc/map.json'))
PC={}
for l in open('/tmp/pc/main.txt'):
  l=l.rstrip('\n')
  if not l:continue
  pid,bpm,meter,key,arr,seq=l.split('|')
  PC[int(pid)]=dict(bpm=bpm,meter=meter,key=key,arr=arr.strip(),seq=[x for x in seq.split(',') if x],grids={})
for l in open('/tmp/pc/grids.txt'):
  l=l.rstrip('\n')
  if not l:continue
  pid,rest=l.split('|',1)
  for part in rest.split(';'):
    lab,g=part.split('=',1);PC[int(pid)]['grids'][lab]='\n'.join(x.strip() for x in g.split('¦'))
def kind(l):
  x=l.lower()
  if re.match(r'pre|pré',x):return 'prerefrain'
  if re.match(r'verse|couplet',x):return 'couplet'
  if re.match(r'post',x):return 'refrain'
  if re.match(r'chorus|refrain',x):return 'refrain'
  if re.match(r'bridge|pont|breakdown|spont',x):return 'pont'
  if re.match(r'tag|vamp',x):return 'tag'
  if re.match(r'ending|fin',x):return 'fin'
  return 'intro'
def fr(l):
  m=re.match(r'^(.*?)\s*(\d*)$',l.strip());b,n=m.group(1).lower(),m.group(2)
  T={'intro':'Intro','verse':'Couplet','pre chorus':'Pré-refrain','prechorus':'Pré-refrain','pre-chorus':'Pré-refrain','chorus':'Refrain','refrain':'Refrain B','post-chorus':'Post-refrain','bridge':'Pont','tag':'Tag','vamp':'Vamp','interlude':'Interlude','instrumental':'Instrumental','turnaround':'Turnaround','breakdown':'Breakdown','outro':'Outro','ending':'Fin'}
  return (T.get(b,l.strip().capitalize())+(' '+n if n else ''))
INT={'intro':(2,3),'couplet':(3,4),'prerefrain':(4,5),'refrain':(6,6),'pont':(5,7),'tag':(5,5),'fin':(3,2)}
norm=lambda s:re.sub(r'[^a-z0-9]','',s.lower())
def chart_grid(g,lab):
  n=norm(lab);cand={norm(k):v for k,v in g.items()}
  for k in (n,re.sub(r'\d+$','',n),n+'1',re.sub(r'\d+$','',n)+'1'):
    if k in cand:return cand[k]
  return None
def bars_of(grid):
  t=0
  for line in grid.split('\n'):
    m=re.search(r'\((\d+)\s*×\)',line);mult=int(m.group(1)) if m else 1
    t+=max(1,len([x for x in re.sub(r'\(.*?\)','',line).split() if re.match(r'^[♭b#♯]?[1-7]',x)]))*mult
  return max(2,t)
out=[];extra=[];done=0;skip=[]
for s in lib['songs']:
  pid=MAP.get(s['id']);P=PC.get(pid) if pid else None
  if not P or not P['seq']:
    if s.get('fromFiche'):s.setdefault('tips',[]).append("Pas de structure dans Planning Center : ordre de ta fiche.")
    out.append(s);skip.append(s['title']);continue
  sunday=not s.get('fromFiche')
  if sunday:  # garder aussi la version travaillée pour le 29
    w=copy.deepcopy(s);w['id']=s['id']+'-29nov';w['title']=s['title']+' (version du 29 nov.)';extra.append(w)
  src={}
  for q in s['sections']:src.setdefault(q['kind'],[]).append(q)
  # étiquettes consécutives identiques -> ×n
  runs=[]
  for lab in P['seq']:
    if runs and runs[-1][0]==lab:runs[-1][1]+=1
    else:runs.append([lab,1])
  order={};secs=[]
  for lab,n in runs:
    k=kind(lab);L=order.setdefault(k,[])
    if lab not in L:L.append(lab)
    i=L.index(lab);fq=None
    if src.get(k):fq=src[k][min(i,len(src[k])-1)]
    cg=chart_grid(P['grids'],lab)
    if sunday and cg:nash,b=cg,bars_of(cg)
    elif fq:nash,b=fq['nash'],int(fq.get('bars') or 8)
    elif cg:nash,b=cg,bars_of(cg)
    else:nash,b='',8
    i0,i1=INT[k]
    if sunday and fq:i0,i1=fq.get('i0',i0),fq.get('i1',i1)
    secs.append({'name':fr(lab)+(f' ×{n}' if n>1 else ''),'kind':k,'bars':b*n,'nash':nash,'i0':i0,'i1':i1,'call':'','cue':'','note':'','mark':'none','t':None})
  s['sections']=secs
  if P['bpm']:s['bpm']=re.sub(r'\.0$','',P['bpm'])
  if P['meter']:s['meter']=P['meter']
  s['ref']=f"Planning Center · {P['arr']}"
  s['pcStructure']=True
  s['tips']=[f"Structure de Planning Center (arrangement « {P['arr']} »).","Grilles de ta fiche quand elle existe, sinon celles de Planning Center. **Mesures estimées : à vérifier.**"]
  out.append(s);done+=1
lib['songs']=out+extra
json.dump(lib,open(LIBF,'w'),ensure_ascii=False,indent=0)
ex=json.load(open(EXF))
for so in ex['state']['songs']:
  if so.get('libId') and any(e['id']==so['libId']+'-29nov' for e in extra):so['libId']+='-29nov'
json.dump(ex,open(EXF,'w'),ensure_ascii=False,indent=0)
print('structures PC',done,'| sans structure',len(skip),'| versions 29 nov',len(extra))
print('sans:',', '.join(skip))
